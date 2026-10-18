import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildFalInput,
  getFalModel,
  type FalParams,
} from "../_shared/falModels.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public terminal = false,
    public rejected = false,
  ) {
    super(message);
  }
}
const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const decode = (value: string) =>
  Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
interface Job {
  user: string;
  submissionId?: string;
  requestId: string;
  modelId: string;
  mediaType: "image" | "video";
  statusUrl: string;
  responseUrl: string;
  cancelUrl: string;
  expires: number;
}
function queueUrl(value: string) {
  const url = new URL(value);
  if (url.origin !== "https://queue.fal.run" || url.username || url.password)
    throw new ApiError("Invalid queue URL.");
  return url.toString();
}
async function signingKey(key: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
async function signJob(job: Job | Callback, key: string) {
  const payload = encode(encoder.encode(JSON.stringify(job)));
  return `${payload}.${encode(new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(key), encoder.encode(payload))))}`;
}
async function readJob(
  token: unknown,
  key: string,
  user: string,
): Promise<Job> {
  if (typeof token !== "string" || token.length > 8192)
    throw new ApiError("Invalid job token.");
  try {
    const [payload, signature] = token.split(".");
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await signingKey(key),
        decode(signature),
        encoder.encode(payload),
      ))
    )
      throw new Error();
    const job: Job = JSON.parse(new TextDecoder().decode(decode(payload)));
    if (job.user !== user || job.expires < Date.now()) throw new Error();
    queueUrl(job.statusUrl);
    queueUrl(job.responseUrl);
    queueUrl(job.cancelUrl);
    return job;
  } catch {
    throw new ApiError(
      "This job has expired or belongs to another account.",
      403,
    );
  }
}
interface Callback {
  kind: "callback";
  user: string;
  submissionId: string;
  expires: number;
}
const database = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
async function submissionResponse(
  response: {
    job: Job;
    params: FalParams;
    requestId: string;
    clientRequestId: string;
  },
  key: string,
) {
  return {
    ...response,
    job: undefined,
    jobToken: await signJob(response.job, key),
    status: "IN_QUEUE",
  };
}
function mediaResult(job: Job, result: Record<string, unknown>) {
  const files =
    job.mediaType === "video"
      ? [result.video]
      : result.images || [result.image];
  if (!Array.isArray(files))
    throw new ApiError("Invalid provider output.", 502);
  const media = files
    .filter((file) => file?.url)
    .map((file) => {
      if (new URL(file.url).protocol !== "https:")
        throw new ApiError("Invalid result URL.", 502);
      return {
        url: file.url,
        contentType:
          file.content_type ||
          (job.mediaType === "video" ? "video/mp4" : "image/png"),
      };
    });
  if (!media.length)
    throw new ApiError(
      "The model returned no media. Try adjusting your prompt.",
      502,
      true,
    );
  return {
    status: "COMPLETED",
    media,
    requestId: job.requestId,
    seed: result.seed,
  };
}
let webhookKeys: { keys: { x: string }[]; expires: number } | undefined;
async function verifyFalWebhook(req: Request, raw: string) {
  const requestId = req.headers.get("X-Fal-Webhook-Request-Id"),
    userId = req.headers.get("X-Fal-Webhook-User-Id"),
    timestamp = req.headers.get("X-Fal-Webhook-Timestamp"),
    signature = req.headers.get("X-Fal-Webhook-Signature");
  if (
    !requestId ||
    !userId ||
    !timestamp ||
    !signature ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
    !/^[0-9a-f]{128}$/i.test(signature)
  )
    return false;
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(raw))),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const message = encoder.encode(
    [requestId, userId, timestamp, digest].join("\n"),
  );
  const bytes = Uint8Array.from(signature.match(/../g)!, (pair) =>
    parseInt(pair, 16),
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!webhookKeys || webhookKeys.expires < Date.now()) {
      const response = await fetch(
        "https://rest.fal.ai/.well-known/jwks.json",
        { signal: AbortSignal.timeout(10000), redirect: "error" },
      );
      if (!response.ok)
        throw new ApiError("Could not verify webhook source.", 503);
      webhookKeys = {
        keys: (await response.json()).keys,
        expires: Date.now() + 3600000,
      };
    }
    for (const key of webhookKeys!.keys) {
      try {
        if (
          await crypto.subtle.verify(
            "Ed25519",
            await crypto.subtle.importKey(
              "raw",
              decode(key.x),
              "Ed25519",
              false,
              ["verify"],
            ),
            bytes,
            message,
          )
        )
          return true;
      } catch {
        /* Try the next public key. */
      }
    }
    webhookKeys = undefined;
  }
  return false;
}
async function receiveCallback(req: Request, token: string) {
  const key = Deno.env.get("FAL_JOB_SIGNING_KEY") || Deno.env.get("FAL_KEY");
  if (!key) throw new ApiError("Generation is unavailable.", 503);
  let callback: Callback;
  try {
    if (token.length > 8192) throw new Error();
    const [payload, signature] = token.split(".");
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await signingKey(key),
        decode(signature),
        encoder.encode(payload),
      ))
    )
      throw new Error();
    callback = JSON.parse(new TextDecoder().decode(decode(payload)));
    if (callback.kind !== "callback" || callback.expires < Date.now())
      throw new Error();
  } catch {
    throw new ApiError("Invalid callback token.", 403);
  }
  const raw = await req.text();
  if (raw.length > 1000000) throw new ApiError("Callback is too large.");
  if (!(await verifyFalWebhook(req, raw)))
    throw new ApiError("Invalid fal webhook signature.", 403);
  const body = JSON.parse(raw);
  if (
    typeof body.request_id !== "string" ||
    body.request_id.length > 200 ||
    ![body.request_id, body.gateway_request_id].includes(
      req.headers.get("X-Fal-Webhook-Request-Id"),
    )
  )
    throw new ApiError("Invalid callback request.");
  const ledger = database();
  const { data: row, error } = await ledger
    .from("fal_submissions")
    .select("*")
    .eq("user_id", callback.user)
    .eq("client_request_id", callback.submissionId)
    .single();
  if (error || !row?.metadata)
    throw new ApiError("Could not find the reserved request.", 503);
  if (row.response?.requestId && row.response.requestId !== body.request_id)
    throw new ApiError("Callback does not match the reserved request.", 403);
  if (row.status === "completed" || row.status === "failed")
    return json({ received: true });
  const base = `https://queue.fal.run/${row.metadata.endpoint.split("/").slice(0, 2).join("/")}/requests/${encodeURIComponent(body.request_id)}`;
  const job: Job = row.response?.job || {
    user: callback.user,
    submissionId: callback.submissionId,
    requestId: body.request_id,
    modelId: row.metadata.modelId,
    mediaType: row.metadata.mediaType,
    statusUrl: base + "/status",
    responseUrl: base,
    cancelUrl: base + "/cancel",
    expires: Date.now() + 86400000,
  };
  const response = {
    job,
    params: row.metadata.params,
    requestId: job.requestId,
    clientRequestId: callback.submissionId,
  };
  const change =
    body.status === "ERROR"
      ? {
          status: "failed",
          response,
          failure: {
            message: String(
              body.error || "The provider could not complete this request.",
            ).slice(0, 600),
            status: 502,
          },
        }
      : body.status === "OK"
        ? {
            status: body.payload ? "completed" : "queued",
            response,
            result: body.payload || null,
          }
        : null;
  if (!change) throw new ApiError("Unknown webhook status.");
  if (body.status === "OK" && body.payload) mediaResult(job, body.payload);
  const { error: saveError } = await ledger
    .from("fal_submissions")
    .update(change)
    .eq("user_id", callback.user)
    .eq("client_request_id", callback.submissionId)
    .neq("status", "completed");
  if (saveError)
    throw new ApiError("Could not persist callback. Retry delivery.", 503);
  return json({ received: true });
}
async function falFetch(url: string, key: string, init: RequestInit = {}) {
  const response = await fetch(queueUrl(url), {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(25000),
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(body.detail)
      ? body.detail
          .map((d: { msg?: string }) => d.msg)
          .filter(Boolean)
          .join("; ")
      : typeof body.detail === "string"
        ? body.detail
        : body.error || body.message;
    throw new ApiError(
      typeof detail === "string"
        ? detail.slice(0, 600)
        : `fal returned ${response.status}. Please try again.`,
      response.status === 429 ? 429 : response.status === 422 ? 400 : 502,
      false,
      response.status >= 400 && response.status < 500,
    );
  }
  return body;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  try {
    const callbackToken = new URL(req.url).searchParams.get("callback");
    if (callbackToken) return await receiveCallback(req, callbackToken);
    const bearer = req.headers.get("Authorization");
    if (!bearer?.startsWith("Bearer "))
      throw new ApiError("Please sign in to generate media.", 401);
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: bearer } },
        auth: { persistSession: false },
      },
    );
    const {
      data: { user },
      error,
    } = await client.auth.getUser(bearer.slice(7));
    if (error || !user)
      throw new ApiError(
        "Your session has expired. Please sign in again.",
        401,
      );
    const key = Deno.env.get("FAL_KEY") || Deno.env.get("FAL_API_KEY");
    if (!key)
      throw new ApiError(
        "Generation is temporarily unavailable. Please try again later.",
        503,
      );
    const jobKey = Deno.env.get("FAL_JOB_SIGNING_KEY") || key;
    const text = await req.text();
    if (text.length > 40000) throw new ApiError("Request is too large.");
    const body = JSON.parse(text);
    if (body.action === "submit") {
      const operation =
        body.operation === "remove-background"
          ? "remove-background"
          : "generate";
      const model = getFalModel(body.modelId);
      if (operation === "generate" && !model)
        throw new ApiError("Choose a supported model.");
      const params = body.params as FalParams;
      if (!params || typeof params !== "object")
        throw new ApiError("Missing generation settings.");
      if (operation === "generate" && params.initImageStoragePath) {
        if (params.initImageBucket === "video" && !model!.videoEndpoint)
          throw new ApiError(
            `${model!.name} does not support video references.`,
          );
        if (params.initImageBucket !== "video" && !model!.editEndpoint)
          throw new ApiError(
            `${model!.name} does not support reference images.`,
          );
      }
      if (
        operation === "generate" &&
        (typeof params.prompt !== "string" ||
          !params.prompt.trim() ||
          params.prompt.length > 10000)
      )
        throw new ApiError("Enter a prompt between 1 and 10,000 characters.");
      if (
        typeof params.negativePrompt !== "undefined" &&
        (typeof params.negativePrompt !== "string" ||
          params.negativePrompt.length > 3000)
      )
        throw new ApiError("Negative prompt is too long.");
      if (
        model?.input === "pixverse" &&
        encoder.encode(params.prompt).length > 2048
      )
        throw new ApiError(
          "PixVerse prompts must fit within 2,048 UTF-8 bytes. Shorten your prompt.",
        );
      let sourceUrl: string | undefined;
      if (params.initImageStoragePath) {
        if (
          typeof params.initImageStoragePath !== "string" ||
          !params.initImageStoragePath.startsWith(`${user.id}/`) ||
          params.initImageStoragePath.includes("..")
        )
          throw new ApiError(
            "Reference must be a file from your own library.",
            403,
          );
        const bucket = params.initImageBucket === "video" ? "video" : "images";
        if (operation === "remove-background" && bucket !== "images")
          throw new ApiError("Background removal needs an image.");
        const { data, error: storageError } = await client.storage
          .from(bucket)
          .createSignedUrl(params.initImageStoragePath, 3600);
        if (storageError || !data?.signedUrl)
          throw new ApiError("Could not load the reference. Upload it again.");
        sourceUrl = data.signedUrl;
      }
      if (operation === "remove-background" && !sourceUrl)
        throw new ApiError("Choose an image to remove its background.");
      const built =
        operation === "remove-background"
          ? {
              endpoint: "fal-ai/birefnet",
              input: { image_url: sourceUrl, output_format: "png" },
              params,
            }
          : buildFalInput(model!, params, sourceUrl);
      // Reserve the caller's UUID before any billable request. A lost response
      // must check this reservation, never automatically submit a second job.
      const clientRequestId = body.clientRequestId;
      if (
        typeof clientRequestId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          clientRequestId,
        )
      )
        throw new ApiError(
          "Missing request identifier. Refresh the app and try again.",
        );
      const ledger = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const fingerprint = encode(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            encoder.encode(
              JSON.stringify({
                modelId: body.modelId,
                operation,
                params: built.params,
              }),
            ),
          ),
        ),
      );
      const metadata = {
        endpoint: built.endpoint,
        modelId: body.modelId || "birefnet",
        mediaType: operation === "remove-background" ? "image" : model!.type,
        params: built.params,
      };
      const { data: reservation, error: reserveError } = await ledger.rpc(
        "reserve_fal_submission",
        {
          p_user: user.id,
          p_request: clientRequestId,
          p_fingerprint: fingerprint,
          p_metadata: metadata,
        },
      );
      if (reserveError || !reservation)
        throw new ApiError(
          "Could not reserve your request. Retry checks the same request.",
          503,
        );
      if (reservation.limit) throw new ApiError(reservation.limit, 429, true);
      if (reservation.existing) {
        const existing = reservation.existing;
        if (existing.fingerprint !== fingerprint)
          throw new ApiError(
            "This request identifier belongs to different settings.",
            409,
            true,
          );
        if (["queued", "completed"].includes(existing.status))
          return json(await submissionResponse(existing.response, jobKey));
        if (existing.status === "failed")
          throw new ApiError(
            existing.failure.message,
            existing.failure.status,
            true,
          );
        return json(
          {
            pending: true,
            clientRequestId,
            message:
              "Submission has not been confirmed. Retry checks this same request without submitting again.",
          },
          202,
        );
      }
      let queued;
      try {
        const callback = await signJob(
          {
            kind: "callback",
            user: user.id,
            submissionId: clientRequestId,
            expires: Date.now() + 172800000,
          },
          jobKey,
        );
        const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fal-media?callback=${encodeURIComponent(callback)}`;
        queued = await falFetch(
          `https://queue.fal.run/${built.endpoint}?fal_webhook=${encodeURIComponent(callbackUrl)}`,
          key,
          { method: "POST", body: JSON.stringify(built.input) },
        );
      } catch (err) {
        // Only an explicit rejection is safe to retry as a new billable job.
        // Timeouts, server failures and process interruption retain the reservation.
        if (err instanceof ApiError && err.rejected) {
          const { error: failureError } = await ledger
            .from("fal_submissions")
            .update({
              status: "failed",
              failure: { message: err.message, status: err.status },
            })
            .eq("user_id", user.id)
            .eq("client_request_id", clientRequestId)
            .eq("status", "submitting");
          if (!failureError) err.terminal = true;
        }
        throw err;
      }
      const job: Job = {
        user: user.id,
        submissionId: clientRequestId,
        requestId: queued.request_id,
        modelId: body.modelId || "birefnet",
        mediaType: operation === "remove-background" ? "image" : model!.type,
        statusUrl: queueUrl(queued.status_url),
        responseUrl: queueUrl(queued.response_url),
        cancelUrl: queueUrl(queued.cancel_url),
        expires: Date.now() + 86400000,
      };
      const response = {
        job,
        requestId: job.requestId,
        params: built.params,
        status: "IN_QUEUE",
        queuePosition: queued.queue_position,
        clientRequestId,
      };
      const { error: saveError } = await ledger
        .from("fal_submissions")
        .update({ status: "queued", response })
        .eq("user_id", user.id)
        .eq("client_request_id", clientRequestId)
        .eq("status", "submitting");
      if (saveError)
        throw new ApiError(
          "Your request was submitted, but confirmation could not be saved. Retry checks the same request; it will not submit again.",
          503,
        );
      return json(await submissionResponse(response, jobKey));
    }
    const job = await readJob(body.jobToken, jobKey, user.id);
    const ledger = database();
    const saved = job.submissionId
      ? await ledger
          .from("fal_submissions")
          .select("*")
          .eq("user_id", user.id)
          .eq("client_request_id", job.submissionId)
          .single()
      : null;
    if (saved?.error)
      throw new ApiError(
        "Could not reconnect to this request. Try again shortly.",
        503,
      );
    if (saved?.data?.status === "failed")
      throw new ApiError(
        saved.data.failure.message,
        saved.data.failure.status,
        true,
      );
    if (saved?.data?.status === "completed") {
      if (body.action === "cancel")
        return json({ status: "ALREADY_COMPLETED" });
      if (body.action !== "status") throw new ApiError("Unknown action.");
      return json(mediaResult(job, saved.data.result));
    }
    if (body.action === "cancel") {
      const result = await falFetch(job.cancelUrl, key, { method: "PUT" });
      if (job.submissionId && ["CANCELLED", "CANCELED"].includes(result.status))
        await ledger
          .from("fal_submissions")
          .update({ status: "cancelled" })
          .eq("user_id", user.id)
          .eq("client_request_id", job.submissionId);
      return json({ status: result.status || "CANCELLATION_REQUESTED" });
    }
    if (body.action !== "status") throw new ApiError("Unknown action.");
    const status = await falFetch(`${job.statusUrl}?logs=1`, key);
    if (status.status !== "COMPLETED")
      return json({
        status: status.status,
        queuePosition: status.queue_position,
      });
    if (status.error) {
      if (job.submissionId)
        await ledger
          .from("fal_submissions")
          .update({
            status: "failed",
            failure: {
              message: String(status.error).slice(0, 600),
              status: 502,
            },
          })
          .eq("user_id", user.id)
          .eq("client_request_id", job.submissionId);
      throw new ApiError(String(status.error).slice(0, 600), 502, true);
    }
    const result = await falFetch(job.responseUrl, key);
    const normalized = mediaResult(job, result);
    if (job.submissionId) {
      const { error: resultError } = await ledger
        .from("fal_submissions")
        .update({ status: "completed", result })
        .eq("user_id", user.id)
        .eq("client_request_id", job.submissionId);
      if (resultError)
        throw new ApiError(
          "Your result is ready, but could not be saved. Retry checks the same job.",
          503,
        );
    }
    return json(normalized);
  } catch (err) {
    const status =
      err instanceof ApiError
        ? err.status
        : err instanceof SyntaxError
          ? 400
          : 500;
    return json(
      {
        error:
          err instanceof ApiError
            ? err.message
            : status === 400
              ? "Invalid request JSON."
              : "Generation service could not complete the request. Try again.",
        terminal: err instanceof ApiError && err.terminal,
      },
      status,
    );
  }
}
if (import.meta.main) Deno.serve(handler);
