import { ImageProvider, GenParams, GenerateResult, ModelId } from "../types";
import { supabase } from "../supabase/client";
import { downloadGeneratedFile } from "../lib/media";
import {
  FAL_MODELS,
  getFalModel,
  normalizeModelId,
} from "../supabase/functions/_shared/falModels";

type Options = { signal?: AbortSignal; onStatus?: (message: string) => void };
class FalError extends Error {
  constructor(
    message: string,
    public terminal = false,
  ) {
    super(message);
  }
}
interface PendingJob {
  clientRequestId: string;
  jobToken?: string;
  requestId?: string;
  params: GenParams;
  expires: number;
}
const pendingJobs = new Map<string, PendingJob>();
function rememberJob(key: string, job?: PendingJob) {
  if (job) pendingJobs.set(key, job);
  else pendingJobs.delete(key);
  try {
    if (job) sessionStorage.setItem(key, JSON.stringify(job));
    else sessionStorage.removeItem(key);
  } catch {
    /* A retry can still recover in this tab when storage is disabled. */
  }
}
function existingJob(key: string): PendingJob | undefined {
  let job = pendingJobs.get(key);
  try {
    job ??= JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    /* Ignore invalid cache. */
  }
  if (
    job &&
    job.expires > Date.now() &&
    (typeof job.jobToken === "string" ||
      typeof job.clientRequestId === "string")
  )
    return job;
  rememberJob(key);
}
export async function callFal(
  body: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const { data, error } = await supabase.functions.invoke("fal-media", {
    body,
    signal,
  });
  if (signal?.aborted)
    throw new DOMException("Generation stopped.", "AbortError");
  if (error) {
    let message = error.message,
      terminal = false;
    if (error.context instanceof Response) {
      const detail = await error.context.json().catch(() => null);
      message = detail?.error || message;
      terminal = !!detail?.terminal || error.context.status === 400;
    }
    throw new FalError(message, terminal);
  }
  if (data?.error) throw new Error(data.error);
  if (!data)
    throw new Error("The generation service returned an empty response.");
  return data;
}
const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted)
      return reject(new DOMException("Generation stopped.", "AbortError"));
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Generation stopped.", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
export async function generateFal(
  modelId: ModelId,
  params: GenParams,
  options: Options = {},
  operation = "generate",
): Promise<GenerateResult> {
  const { signal, onStatus } = options;
  const name =
    operation === "remove-background"
      ? "Background removal"
      : getFalModel(modelId)?.name;
  if (signal?.aborted)
    throw new DOMException("Generation stopped.", "AbortError");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in to generate media.");
  const fingerprint = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify({ modelId, params, operation })),
    ),
  );
  const cacheKey = `vibecanvas:fal-job:${session.user.id}:${Array.from(fingerprint, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const previous = existingJob(cacheKey);
  onStatus?.(
    previous
      ? `Reconnecting to your ${name} request…`
      : `Submitting to ${name}…`,
  );
  let submitted: PendingJob = previous || {
    clientRequestId: crypto.randomUUID(),
    params,
    expires: Date.now() + 23 * 60 * 60 * 1000,
  };
  // Persist before the POST, including when a response never reaches this tab.
  rememberJob(cacheKey, submitted);
  try {
    const start = Date.now();
    while (!submitted.jobToken) {
      const response = await callFal({
        action: "submit",
        modelId,
        params,
        operation,
        clientRequestId: submitted.clientRequestId,
      });
      if (response.pending) {
        if (Date.now() - start > 60000) throw new FalError(response.message);
        onStatus?.("Checking confirmation of your original request…");
        await delay(2000, signal);
        continue;
      }
      if (!response.jobToken)
        throw new FalError(
          "Your request could not be confirmed. Retry checks this same request.",
        );
      submitted = { ...submitted, ...response };
      rememberJob(cacheKey, submitted);
    }
  } catch (err) {
    if (err instanceof FalError && err.terminal) rememberJob(cacheKey);
    throw err;
  }
  const cancel = async () => {
    try {
      const result = await callFal({
        action: "cancel",
        jobToken: submitted.jobToken,
      });
      if (["CANCELLED", "CANCELED"].includes(result.status))
        rememberJob(cacheKey);
    } catch {
      // Preserve the handle when cancellation is uncertain so a retry can recover the output.
    }
  };
  const abort = () => {
    void cancel();
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) {
      await cancel();
      throw new DOMException("Generation stopped.", "AbortError");
    }
    const started = Date.now();
    let failures = 0;
    while (Date.now() - started < 30 * 60 * 1000) {
      await delay(getFalModel(modelId)?.type === "video" ? 4000 : 1500, signal);
      let state;
      try {
        state = await callFal(
          { action: "status", jobToken: submitted.jobToken },
          signal,
        );
        failures = 0;
      } catch (err) {
        if (signal?.aborted || ++failures > 2) throw err;
        onStatus?.("Connection interrupted. Reconnecting to your request…");
        await delay(2000, signal);
        continue;
      }
      if (state.status === "COMPLETED") {
        onStatus?.(`Saving ${name} result…`);
        const images = await Promise.all(
          state.media.map(
            async (file: { url: string; contentType: string }) => {
              const blob = await downloadGeneratedFile(file, signal);
              return {
                blob:
                  blob.type === file.contentType
                    ? blob
                    : new Blob([blob], { type: file.contentType }),
                meta: {
                  provider: "fal",
                  modelUsed: modelId,
                  requestId: submitted.requestId,
                  outputUrl: file.url,
                  mediaType:
                    operation === "remove-background"
                      ? "image"
                      : getFalModel(modelId)?.type,
                  seed: state.seed,
                },
              };
            },
          ),
        );
        return {
          images,
          params: submitted.params,
          acknowledgeSaved: () => rememberJob(cacheKey),
        };
      }
      if (state.status === "IN_QUEUE")
        onStatus?.(
          `${name}: queued${typeof state.queuePosition === "number" ? ` · ${state.queuePosition} ahead` : ""}`,
        );
      else if (state.status === "IN_PROGRESS")
        onStatus?.(
          `${name}: generating${getFalModel(modelId)?.type === "video" ? " · videos can take several minutes" : ""}…`,
        );
      else {
        rememberJob(cacheKey);
        throw new Error(
          "This request was cancelled or is no longer available.",
        );
      }
    }
    await cancel();
    throw new Error(
      "Generation took longer than 30 minutes. Cancellation was requested; try again later.",
    );
  } catch (error) {
    if (error instanceof FalError && error.terminal) rememberJob(cacheKey);
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
export const imageProviders: Partial<Record<ModelId, ImageProvider>> =
  Object.fromEntries(
    Object.entries(FAL_MODELS).map(([id, model]) => [
      id,
      {
        id: id as ModelId,
        name: model.name,
        isConfigured: () => true,
        supports: {
          img2img: !!getFalModel(id)?.editEndpoint,
          negativePrompt: !!getFalModel(id)?.negativePrompt,
          seed: !!getFalModel(id)?.seed,
          guidance: false,
          steps: false,
        },
        generate: (params: GenParams, options?: Options) =>
          generateFal(id as ModelId, params, options),
      },
    ]),
  );
export const getProvider = (id: ModelId): ImageProvider =>
  imageProviders[normalizeModelId(id)]!;
