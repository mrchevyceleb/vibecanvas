import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useGenerationStore } from "../store/useGenerationStore";
import { useLibraryStore } from "../store/useLibraryStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useTemplatesStore } from "../store/useTemplatesStore";
import { getProvider } from "../services/imageProviders";
import {
  FAL_MODELS,
  getFalModel,
  normalizeModelId,
  normalizeParams,
} from "../supabase/functions/_shared/falModels";
import { MODEL_DETAILS, RESOLUTION_LABELS } from "../constants";
import {
  AspectRatio,
  GenParams,
  ImageRecord,
  ModelId,
  Resolution,
  Template,
} from "../types";
import { toast } from "../components/ui/Toaster";
import { MediaCard } from "../components/MediaCard";
import { Lightbox } from "../components/Lightbox";
import { UploadZone } from "../components/UploadZone";
import { useImageLoader } from "../hooks/useImageLoader";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { CloseIcon, StarIcon } from "../components/ui/Icons";
import { MediaRecoveryError } from "../lib/media";
import { useImageEdits } from "../hooks/useImageEdits";
import { ImageEditComposer } from "../components/ImageEditComposer";

const videoIdeas = [
  [
    "Golden hour",
    "A slow tracking shot through a sunlit olive grove, golden light filtering through leaves, gentle breeze, cinematic film grain.",
  ],
  [
    "Product reveal",
    "A sleek glass perfume bottle emerging from mist on a dark stone pedestal. Slow camera orbit, soft rim lighting, luxury product commercial.",
  ],
  [
    "A little surreal",
    "A miniature astronaut tending a garden on the moon. Gentle camera push, earth glowing in the background, playful cinematic animation.",
  ],
];
function readDraft(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}
const HomePage: React.FC<{ mode: "image" | "video" }> = ({ mode }) => {
  const { user } = useAuth(),
    location = useLocation(),
    navigate = useNavigate();
  const draftKey = `vibecanvas:draft:${user?.id}:${mode}`;
  const [prompt, setPrompt] = useState(() => readDraft(draftKey).prompt || "");
  const [negativePrompt, setNegativePrompt] = useState(
    () => readDraft(draftKey).negativePrompt || "",
  );
  const [seed, setSeed] = useState("");
  const [reference, setReference] = useState<{
    path: string;
    bucket: "images" | "video";
  } | null>(null);
  const [showReference, setShowReference] = useState(false),
    [showAdvanced, setShowAdvanced] = useState(false),
    [showOptions, setShowOptions] = useState(false);
  const [compare, setCompare] = useState(false),
    [compareModels, setCompareModels] = useState<ModelId[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ImageRecord | null>(
    null,
  );
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const settings = useSettingsStore();
  const generation = useGenerationStore();
  const activeImageRun =
    mode === "image" &&
    generation.isGenerating &&
    generation.activeModels.some((id) => getFalModel(id)?.type === "image");
  const [showCreationControls, setShowCreationControls] = useState(
    () =>
      !activeImageRun &&
      !generation.results.some((record) => record.mediaType === mode),
  );
  const composerExpanded = mode === "video" || showCreationControls;
  const focusCreation = useRef(false);
  const { imageRecords, loading, fetchLibraryContent, addImage, toggleStar } =
    useLibraryStore();
  const { templates, fetchTemplates, addTemplate } = useTemplatesStore();
  const modelId = (
    getFalModel(settings.modelId)?.type === mode
      ? settings.modelId
      : mode === "image"
        ? settings.imageModelId
        : settings.videoModelId
  ) as ModelId;
  const model = getFalModel(modelId)!;
  const models = Object.entries(FAL_MODELS).filter(
    ([, value]) => value.type === mode,
  );
  const { imageUrl: referenceUrl } = useImageLoader(
    reference?.path,
    reference?.bucket,
  );
  const { isListening, isAvailable, toggleListening } = useSpeechRecognition(
    (text) => setPrompt((prev: string) => `${prev}${prev ? " " : ""}${text}`),
  );
  const params: GenParams = normalizeParams(model, {
    prompt,
    negativePrompt,
    aspectRatio: settings.aspectRatio,
    resolution: settings.resolution,
    duration: settings.duration,
    generateAudio: settings.generateAudio,
    seed: seed === "" ? undefined : Number(seed),
    initImageStoragePath: reference?.path,
    initImageBucket: reference?.bucket,
  });
  const referenceSupported =
    !reference ||
    (reference.bucket === "video"
      ? !!model.videoEndpoint
      : !!model.editEndpoint);
  const visibleResults = generation.results.filter(
    (record) => record.mediaType === mode,
  );
  const recent = imageRecords
    .filter((record) => record.mediaType === mode)
    .slice(0, 8);

  const canvasRecords = visibleResults.length
    ? visibleResults
    : recent.slice(0, 1);
  useEffect(() => {
    if (activeImageRun) setShowCreationControls(false);
    else if (
      mode === "image" &&
      generation.error &&
      generation.retryRequest?.mode === "image" &&
      !canvasRecords.length
    ) {
      focusCreation.current = true;
      setShowCreationControls(true);
    }
  }, [
    activeImageRun,
    mode,
    generation.error,
    generation.retryRequest?.mode,
    canvasRecords.length,
  ]);
  const lastResultId = useRef(visibleResults[0]?.id);
  useEffect(() => {
    const header = document.querySelector(".app-header");
    if (!header) return;
    const syncHeaderHeight = () =>
      canvasRef.current?.style.setProperty(
        "--studio-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
    syncHeaderHeight();
    const observer = new ResizeObserver(syncHeaderHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (composerExpanded && focusCreation.current) {
      focusCreation.current = false;
      promptRef.current?.focus();
      promptRef.current?.scrollIntoView({ block: "center" });
    } else if (!composerExpanded) {
      canvasRef.current?.scrollIntoView({ block: "start" });
    }
  }, [composerExpanded]);
  useEffect(() => {
    const id = visibleResults[0]?.id;
    if (id && id !== lastResultId.current) {
      canvasRef.current?.scrollIntoView({
        block: "start",
        behavior:
          mode === "image" ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
      });
    }
    lastResultId.current = id;
  }, [visibleResults[0]?.id]);

  useEffect(() => {
    settings.setModelId(modelId);
  }, [modelId]);
  useEffect(() => {
    if (user) {
      void fetchLibraryContent(user.id);
      void fetchTemplates(user.id);
    }
  }, [user?.id]);
  useEffect(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ prompt, negativePrompt }),
      );
    } catch {
      /* Storage can be disabled. */
    }
  }, [draftKey, prompt, negativePrompt]);
  useEffect(() => {
    if (!generation.isGenerating || !generation.startedAt) return;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - generation.startedAt!) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [generation.isGenerating, generation.startedAt]);
  useEffect(() => {
    const record = location.state?.remixRecord as ImageRecord | undefined;
    if (!record) return;
    focusCreation.current = true;
    setShowCreationControls(true);
    setPrompt(
      record.sourceType === "upload"
        ? ""
        : record.params?.prompt || record.promptTextAtGen,
    );
    setReference({
      path: record.storage_path,
      bucket: record.mediaType === "video" ? "video" : "images",
    });
    setShowReference(true);
    if (record.mediaType === "video") settings.setModelId("wan-2.6");
    else if (!model.editEndpoint)
      settings.setModelId(
        mode === "video"
          ? "veo-3.1-generate-preview"
          : "gemini-3.1-flash-image-preview",
      );
    if (record.params?.aspectRatio)
      settings.setAspectRatio(record.params.aspectRatio);
    navigate(location.pathname, { replace: true, state: null });
    promptRef.current?.focus();
  }, [location.state]);

  const applyTemplate = (template: Template) => {
    if (generation.isGenerating) return;
    settings.setModelId(normalizeModelId(template.defaultModel));
    if (template.params.aspectRatio)
      settings.setAspectRatio(template.params.aspectRatio);
    if (template.params.resolution)
      settings.setResolution(template.params.resolution);
    if (template.params.duration)
      settings.setDuration(template.params.duration);
    setPrompt(template.params.prompt || "");
    setNegativePrompt(template.params.negativePrompt || "");
    setReference(null);
    promptRef.current?.focus();
  };
  const saveTemplate = async () => {
    if (!user || !prompt.trim()) return;
    const name = window.prompt("Name this preset");
    if (name?.trim())
      await addTemplate(
        {
          name: name.trim(),
          defaultModel: modelId,
          params: {
            ...params,
            initImageStoragePath: undefined,
            initImageBucket: undefined,
          },
        },
        user.id,
      );
  };
  const handleGenerate = async (retry = false) => {
    if (!user || generation.isGenerating || uploading) return;
    const prior = retry ? generation.retryRequest : null;
    if (retry && (!prior || prior.mode !== mode)) return;
    const requestParams = prior?.params || {
      ...params,
      negativePrompt,
      seed: seed === "" ? undefined : Number(seed),
      duration: settings.duration,
      resolution: settings.resolution,
      aspectRatio: settings.aspectRatio,
    };
    if (!requestParams.prompt.trim()) return;
    const ids = prior?.models || (compare ? compareModels : [modelId]);
    if (
      !ids.length ||
      ids.some(
        (id) =>
          requestParams.initImageStoragePath &&
          (requestParams.initImageBucket === "video"
            ? !getFalModel(id)?.videoEndpoint
            : !getFalModel(id)?.editEndpoint),
      )
    )
      return;
    if (!prior && seed && (!/^\d+$/.test(seed) || Number(seed) > 2147483647)) {
      toast("Seed must be a whole number from 0 to 2,147,483,647.", "error");
      return;
    }
    const run = generation.startGeneration(ids);
    if (!run) return;
    if (mode === "image") setShowCreationControls(false);
    useGenerationStore.setState({
      retryRequest: {
        params: requestParams,
        mode,
        models: ids,
        runId: run.runId,
      },
    });
    const generated = await Promise.allSettled(
      ids.map(async (id) => {
        const provider = getProvider(id);
        const modelParams = normalizeParams(getFalModel(id)!, requestParams);
        const result = await provider.generate(modelParams, {
          signal: run.signal,
          onStatus: (message) =>
            useGenerationStore
              .getState()
              .setGenerationStatus(message, id, run.runId),
        });
        if (run.signal.aborted) throw new DOMException("Stopped", "AbortError");
        const records: ImageRecord[] = [];
        for (const image of result.images) {
          if (run.signal.aborted)
            throw new DOMException("Stopped", "AbortError");
          const record = await addImage(
            {
              model: id,
              params: result.params || modelParams,
              promptTextAtGen: requestParams.prompt,
              sourceType: requestParams.initImageStoragePath
                ? "edit"
                : "generate",
              meta: image.meta,
              folder_id: null,
              mediaType: mode,
            },
            image.blob,
            user.id,
          );
          if (!record)
            throw new MediaRecoveryError(
              `${provider.name} generated a file, but it could not be saved to your library.`,
              String(image.meta?.outputUrl || ""),
            );
          records.push(record);
        }
        result.acknowledgeSaved?.();
        if (useGenerationStore.getState().retryRequest?.runId === run.runId) {
          const remaining =
            useGenerationStore
              .getState()
              .retryRequest?.models.filter((value) => value !== id) || [];
          useGenerationStore.setState({
            retryRequest: remaining.length
              ? {
                  params: requestParams,
                  mode,
                  models: remaining,
                  runId: run.runId,
                }
              : null,
          });
        }
        return records;
      }),
    );
    if (run.signal.aborted || useGenerationStore.getState().runId !== run.runId)
      return;
    const records = generated.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    const failures = generated.flatMap((result, index) =>
      result.status === "rejected"
        ? [
            `${MODEL_DETAILS[ids[index]].name}: ${result.reason?.message || "Generation failed"}`,
          ]
        : [],
    );
    useGenerationStore.setState({
      recoveryLinks: generated.flatMap((result, index) =>
        result.status === "rejected" &&
        result.reason instanceof MediaRecoveryError &&
        result.reason.downloadUrl
          ? [
              {
                url: result.reason.downloadUrl,
                name: MODEL_DETAILS[ids[index]].name,
              },
            ]
          : [],
      ),
    });
    if (records.length) {
      generation.setGenerationSuccess(records, run.runId);
      if (failures.length) {
        useGenerationStore.setState({ error: failures.join(" · ") });
        toast("Some models failed. Successful results were saved.", "error");
      } else
        toast(
          `${records.length} ${mode}${records.length === 1 ? "" : "s"} saved to your library.`,
        );
    } else
      generation.setGenerationError(
        failures.join(" · ") || "No media returned. Try again.",
        run.runId,
      );
  };
  const compareEligible =
    compareModels.length > 0 &&
    compareModels.every(
      (id) =>
        !reference ||
        (reference.bucket === "video"
          ? !!getFalModel(id)?.videoEndpoint
          : !!getFalModel(id)?.editEndpoint),
    );
  const canGenerate =
    !!prompt.trim() &&
    !generation.isGenerating &&
    !uploading &&
    (compare ? compareEligible : referenceSupported);
  const availableDurations =
    reference?.bucket === "video" ? model.videoDurations : model.durations;
  const safeDurations =
    model.input === "pixverse" && params.resolution === "1080p"
      ? availableDurations?.filter((value) => value !== "10")
      : availableDurations;

  return (
    <div
      className={`studio page-shell ${composerExpanded ? "" : "studio-focused"}`}
    >
      <div className="page-heading" hidden={!composerExpanded}>
        <div>
          <h1>{mode === "image" ? "Create an image" : "Create a video"}</h1>
          <p className="muted">Start with an idea. Make it yours.</p>
        </div>
      </div>
      <div className="studio-grid">
        <section
          id="creation-controls"
          className="composer panel"
          hidden={!composerExpanded}
          aria-label={`Create ${mode}`}
        >
          <label htmlFor="creation-prompt" className="field-label">
            What would you like to make?
          </label>
          <div className="prompt-container">
            <textarea
              id="creation-prompt"
              ref={promptRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={2}
              maxLength={10000}
              placeholder={
                mode === "image"
                  ? "A ceramic coffee cup on a sunlit kitchen table, soft shadows, editorial photography…"
                  : "Describe the subject, action, camera movement, and atmosphere…"
              }
              disabled={generation.isGenerating}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  if (canGenerate) void handleGenerate();
                }
              }}
            />
            <div className="prompt-tools">
              <span>{prompt.length.toLocaleString()} / 10,000</span>
              {isAvailable && (
                <button
                  className={`quiet-button ${isListening ? "listening" : ""}`}
                  type="button"
                  aria-pressed={isListening}
                  disabled={generation.isGenerating}
                  onClick={toggleListening}
                >
                  {isListening ? "Stop dictation" : "Dictate"}
                </button>
              )}
            </div>
          </div>
          <div
            className={`composer-toolbar ${mode === "video" ? "with-duration" : ""}`}
          >
            <div className="model-control">
              <label htmlFor="model" className="field-label">
                Model
              </label>
              <select
                id="model"
                value={modelId}
                disabled={generation.isGenerating}
                onChange={(event) =>
                  settings.setModelId(event.target.value as ModelId)
                }
              >
                {models.map(([id, value]) => (
                  <option key={id} value={id}>
                    {value.name} · {value.badge}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ratio" className="field-label">
                Shape
              </label>
              <select
                id="ratio"
                value={params.aspectRatio}
                disabled={
                  generation.isGenerating ||
                  (!!reference &&
                    model.sourceControlsAspect &&
                    reference.bucket === "images")
                }
                onChange={(event) =>
                  settings.setAspectRatio(event.target.value as AspectRatio)
                }
              >
                {model.supportedAspectRatios.map((ratio) => (
                  <option key={ratio} value={ratio}>
                    {ratio === "1:1"
                      ? "Square"
                      : Number(ratio.split(":")[0]) >
                          Number(ratio.split(":")[1])
                        ? "Landscape"
                        : "Portrait"}{" "}
                    · {ratio}
                  </option>
                ))}
              </select>
            </div>
            {mode === "video" && (
              <div>
                <label htmlFor="duration" className="field-label">
                  Duration
                </label>
                <select
                  id="duration"
                  value={params.duration}
                  disabled={generation.isGenerating}
                  onChange={(event) => settings.setDuration(event.target.value)}
                >
                  {safeDurations?.map((value) => (
                    <option key={value} value={value}>
                      {value} seconds
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              className="primary-button generate-button"
              onClick={() => void handleGenerate()}
              disabled={!canGenerate}
            >
              {generation.isGenerating
                ? "Creating…"
                : compare
                  ? `Compare ${compareModels.length} models`
                  : `Generate ${mode}`}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <div className="composer-secondary">
            <button
              className="quiet-button"
              aria-expanded={showReference}
              aria-controls="reference-options"
              disabled={generation.isGenerating}
              onClick={() => setShowReference(!showReference)}
            >
              {reference ? "Reference attached" : "＋ Add an image"}
            </button>
            <button
              className="quiet-button"
              aria-expanded={showOptions}
              aria-controls="creation-options"
              onClick={() => setShowOptions(!showOptions)}
            >
              {showOptions ? "Fewer options" : "More options"}
              {compare ? ` · Comparing ${compareModels.length} models` : ""}
            </button>
            <p className="submit-hint">
              {generation.isGenerating
                ? "You can keep browsing while your creation runs."
                : "⌘ / Ctrl + Enter to generate · Automatically saved"}
            </p>
          </div>
          <div id="reference-options" hidden={!showReference}>
            {showReference && (
              <div className="reference-section">
                {reference ? (
                  <div className="reference-preview">
                    {referenceUrl &&
                      (reference.bucket === "video" ? (
                        <video src={referenceUrl} muted />
                      ) : (
                        <img src={referenceUrl} alt="Reference" />
                      ))}
                    <div>
                      <strong>
                        {reference.bucket === "video"
                          ? "Video reference"
                          : "Image reference"}
                      </strong>
                      <p className="field-hint">
                        {mode === "video"
                          ? "Guide the scene and motion."
                          : "Describe the changes in your prompt."}
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Remove reference"
                      onClick={() => setReference(null)}
                      disabled={generation.isGenerating}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ) : (
                  <UploadZone
                    disabled={generation.isGenerating}
                    onUploadingChange={setUploading}
                    onUploadComplete={(path) =>
                      setReference({ path, bucket: "images" })
                    }
                  />
                )}
                {!referenceSupported && (
                  <p className="inline-warning" role="alert">
                    Choose{" "}
                    {reference?.bucket === "video"
                      ? "Wan 2.6 for video references"
                      : "a model that supports image references"}
                    , or remove the reference.
                  </p>
                )}
                {!reference && !model.editEndpoint && (
                  <p className="field-hint">
                    This model supports text prompts. Choose Nano Banana, GPT
                    Image, FLUX.2, or Seedream to edit an image.
                  </p>
                )}
              </div>
            )}
          </div>
          {!referenceSupported && !showReference && (
            <p className="inline-warning" role="alert">
              This model cannot use your reference. Choose a compatible model or
              open the attached reference to remove it.
            </p>
          )}
          <div
            id="creation-options"
            className="creation-options"
            hidden={!showOptions}
          >
            <div className="optional-controls">
              <div>
                <label className="field-label" htmlFor="preset">
                  Presets
                </label>
                <div className="preset-row">
                  <select
                    id="preset"
                    value=""
                    disabled={generation.isGenerating}
                    onChange={(event) => {
                      const template = templates.find(
                        (value) => value.id === event.target.value,
                      );
                      if (template) applyTemplate(template);
                    }}
                  >
                    <option value="">Start with a preset…</option>
                    {templates
                      .filter(
                        (template) =>
                          getFalModel(normalizeModelId(template.defaultModel))
                            ?.type === mode,
                      )
                      .map((template) => (
                        <option value={template.id} key={template.id}>
                          {template.name}
                        </option>
                      ))}
                  </select>
                  <button
                    className="quiet-button"
                    onClick={saveTemplate}
                    disabled={!prompt.trim() || generation.isGenerating}
                  >
                    Save preset
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="resolution" className="field-label">
                  {model.fixedResolution ? "Output" : "Resolution"}
                </label>
                <select
                  id="resolution"
                  value={params.resolution}
                  disabled={generation.isGenerating || model.fixedResolution}
                  onChange={(event) =>
                    settings.setResolution(event.target.value as Resolution)
                  }
                >
                  {model.supportedResolutions.map((res) => (
                    <option value={res} key={res}>
                      {model.fixedResolution
                        ? "Model default"
                        : RESOLUTION_LABELS[res]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="model-description">
              <span className="model-tag">{model.tag}</span>
              {model.description}
            </p>
            {!!reference &&
              model.sourceControlsAspect &&
              reference.bucket === "images" && (
                <p className="field-hint">
                  This model follows the reference image’s proportions.
                </p>
              )}
            {mode === "video" && (
              <>
                {model.audio && (
                  <label className="check-control">
                    <input
                      type="checkbox"
                      checked={settings.generateAudio}
                      disabled={generation.isGenerating}
                      onChange={(event) =>
                        settings.setGenerateAudio(event.target.checked)
                      }
                    />{" "}
                    Generate audio
                  </label>
                )}
              </>
            )}
            {(model.negativePrompt || model.seed) && (
              <>
                <button
                  className="disclosure"
                  aria-expanded={showAdvanced}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <span>Advanced settings</span>
                  <span>{showAdvanced ? "−" : "＋"}</span>
                </button>
                {showAdvanced && (
                  <div className="advanced-fields">
                    {model.negativePrompt && (
                      <div>
                        <label htmlFor="negative" className="field-label">
                          What to avoid
                        </label>
                        <textarea
                          id="negative"
                          rows={2}
                          maxLength={3000}
                          value={negativePrompt}
                          disabled={generation.isGenerating}
                          onChange={(event) =>
                            setNegativePrompt(event.target.value)
                          }
                          placeholder="Blurry details, unwanted text…"
                        />
                      </div>
                    )}
                    {model.seed && (
                      <div>
                        <label htmlFor="seed" className="field-label">
                          Seed <span className="muted">(optional)</span>
                        </label>
                        <input
                          id="seed"
                          type="number"
                          min="0"
                          max="2147483647"
                          step="1"
                          value={seed}
                          disabled={generation.isGenerating}
                          onChange={(event) => setSeed(event.target.value)}
                          placeholder="Random"
                        />
                        <p className="field-hint">
                          Reuse a seed and settings to explore similar results.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            <button
              className="disclosure"
              aria-expanded={compare}
              disabled={generation.isGenerating}
              onClick={() => setCompare(!compare)}
            >
              <span>Compare models</span>
              <span>{compare ? "−" : "＋"}</span>
            </button>
            {compare && (
              <fieldset className="compare-list">
                <legend className="field-hint">
                  Choose up to 3. Each model is a separate generation.
                </legend>
                {models.map(([id, value]) => {
                  const eligible =
                    !reference ||
                    (reference.bucket === "video"
                      ? !!getFalModel(id)?.videoEndpoint
                      : !!getFalModel(id)?.editEndpoint);
                  return (
                    <label key={id}>
                      <input
                        type="checkbox"
                        checked={compareModels.includes(id as ModelId)}
                        disabled={
                          generation.isGenerating ||
                          (!eligible &&
                            !compareModels.includes(id as ModelId)) ||
                          (compareModels.length >= 3 &&
                            !compareModels.includes(id as ModelId))
                        }
                        onChange={() =>
                          setCompareModels((previous) =>
                            previous.includes(id as ModelId)
                              ? previous.filter((value) => value !== id)
                              : [...previous, id as ModelId],
                          )
                        }
                      />
                      <span>{value.name}</span>
                    </label>
                  );
                })}
                <p className="field-hint">
                  Each model uses its nearest supported settings.
                </p>
              </fieldset>
            )}
          </div>
        </section>
        <section
          ref={canvasRef}
          className="canvas-area"
          aria-label="Your creations"
        >
          <div className="section-top">
            {composerExpanded ? <h2>Your canvas</h2> : <h1>Your image</h1>}
            <div className="canvas-tools">
              <span className="canvas-label">
                <i />{" "}
                {generation.isGenerating ? "Creating" : "Ready when you are"}
              </span>
              {mode === "image" &&
                (visibleResults.length > 0 || !composerExpanded) && (
                  <button
                    className="secondary-button"
                    disabled={generation.isGenerating}
                    aria-expanded={composerExpanded}
                    aria-controls="creation-controls"
                    onClick={() => {
                      focusCreation.current = !composerExpanded;
                      setShowCreationControls(!composerExpanded);
                    }}
                  >
                    {composerExpanded ? "Back to image" : "New image"}
                  </button>
                )}
            </div>
          </div>
          {generation.isGenerating && (
            <div
              className="generation-status panel"
              role="status"
              aria-live="polite"
            >
              <div className="spinner" />
              <div>
                <strong>Bringing your idea to life</strong>
                {generation.activeModels.map((id) => (
                  <p key={id}>
                    {generation.statuses[id] ||
                      `${MODEL_DETAILS[id]?.name}: submitting…`}
                  </p>
                ))}
                <span className="field-hint">
                  {Math.floor(elapsed / 60)}:
                  {String(elapsed % 60).padStart(2, "0")} elapsed
                </span>
              </div>
              <button
                className="quiet-button"
                onClick={generation.cancelGeneration}
              >
                Stop
              </button>
            </div>
          )}
          {generation.error &&
            (!generation.retryRequest ||
              generation.retryRequest.mode === mode) && (
              <div className="error-panel" role="alert">
                <strong>
                  {visibleResults.length
                    ? "Some results need another try"
                    : "Let’s try that again"}
                </strong>
                <p>{generation.error}</p>
                {generation.recoveryLinks.map((link) => (
                  <p key={link.url}>
                    <a
                      className="text-link"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download {link.name} original ↗
                    </a>
                  </p>
                ))}
                <div>
                  {generation.retryRequest?.mode === mode && (
                    <button
                      className="quiet-button"
                      disabled={generation.isGenerating || uploading}
                      onClick={() => void handleGenerate(true)}
                    >
                      Retry with this prompt
                    </button>
                  )}
                  <button
                    className="quiet-button"
                    disabled={generation.isGenerating}
                    onClick={() => useGenerationStore.setState({ error: null })}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          {canvasRecords.length > 0 ? (
            <div className="result-grid">
              {canvasRecords.map((record) => (
                <ResultPreview
                  key={record.id}
                  record={record}
                  focusEdit={
                    !composerExpanded && record.id === visibleResults[0]?.id
                  }
                  onOpen={setSelectedRecord}
                  onRemix={(record) => {
                    focusCreation.current = true;
                    setShowCreationControls(true);
                    setReference(
                      record.mediaType === "image"
                        ? { path: record.storage_path, bucket: "images" }
                        : { path: record.storage_path, bucket: "video" },
                    );
                    if (record.mediaType === "video")
                      settings.setModelId("wan-2.6");
                    setShowReference(true);
                    setPrompt(record.params.prompt || record.promptTextAtGen);
                    if (record.mediaType === "image" && !model.editEndpoint)
                      settings.setModelId("gemini-3.1-flash-image-preview");
                    promptRef.current?.focus();
                    promptRef.current?.scrollIntoView({ block: "center" });
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="empty-canvas panel">
              <h2>
                {mode === "image"
                  ? "Your image will appear here"
                  : "Your video will appear here"}
              </h2>
              <p className="muted">
                Describe an idea above, or try one of these.
              </p>
              <div className="idea-chips">
                {mode === "image"
                  ? templates
                      .filter((template) => template.readonly)
                      .slice(0, 3)
                      .map((template) => (
                        <button
                          key={template.id}
                          disabled={generation.isGenerating}
                          onClick={() => applyTemplate(template)}
                        >
                          {template.name}
                          <span>↗</span>
                        </button>
                      ))
                  : videoIdeas.map(([name, idea]) => (
                      <button
                        key={name}
                        disabled={generation.isGenerating}
                        onClick={() => {
                          setPrompt(idea);
                          promptRef.current?.focus();
                        }}
                      >
                        {name}
                        <span>↗</span>
                      </button>
                    ))}
              </div>
            </div>
          )}
          <div className="recent-section">
            <div className="section-top">
              <h2>
                Recent creations{" "}
                <span className="count">
                  {
                    imageRecords.filter((record) => record.mediaType === mode)
                      .length
                  }
                </span>
              </h2>
              <Link to="/library" className="text-link">
                View library ↗
              </Link>
            </div>
            {loading && !recent.length ? (
              <div className="recent-grid">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton recent-skeleton" />
                ))}
              </div>
            ) : recent.length ? (
              <div className="recent-grid">
                {recent.map((record) => (
                  <MediaCard
                    key={record.id}
                    record={record}
                    onOpen={() => setSelectedRecord(record)}
                    onStar={() => toggleStar(record.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="empty-history">
                Your creations will be saved here, ready to revisit and remix.
              </p>
            )}
          </div>
        </section>
      </div>
      {selectedRecord && (
        <Lightbox
          imageRecord={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
};
function ResultPreview({
  record: initialRecord,
  focusEdit,
  onOpen,
  onRemix,
}: {
  record: ImageRecord;
  focusEdit: boolean;
  onOpen: (record: ImageRecord) => void;
  onRemix: (record: ImageRecord) => void;
}) {
  const edits = useImageEdits(initialRecord);
  useEffect(() => {
    if (focusEdit) edits.promptRef.current?.focus({ preventScroll: true });
  }, [focusEdit]);
  const record = edits.current!;
  const { imageUrl, error } = useImageLoader(
    record.storage_path,
    record.mediaType === "video" ? "video" : "images",
  );
  return (
    <article
      className={`result-preview panel ${record.mediaType === "image" ? "result-image-workspace" : ""}`}
    >
      <div className="result-media">
        {error ? (
          <p role="alert">
            Preview unavailable. Open the library to try again.
          </p>
        ) : imageUrl ? (
          record.mediaType === "video" ? (
            <video src={imageUrl} controls preload="metadata" />
          ) : (
            <button
              onClick={() => onOpen(record)}
              disabled={edits.busy}
              aria-label="Open full image"
            >
              <img src={imageUrl} alt={record.promptTextAtGen} />
            </button>
          )
        ) : (
          <div className="spinner" />
        )}
      </div>
      {record.mediaType === "image" && <ImageEditComposer edits={edits} />}
      <div className="result-footer">
        <div>
          <strong>
            {record.sourceType === "upload"
              ? "Uploaded creation"
              : MODEL_DETAILS[record.model]?.name}
          </strong>
          <span>
            Saved to library · {record.params.aspectRatio}
            {record.params.duration ? ` · ${record.params.duration}s` : ""}
          </span>
        </div>
        <div>
          <button
            className="quiet-button"
            onClick={() => onRemix(record)}
            disabled={edits.busy}
          >
            Remix
          </button>
          <button
            className="secondary-button"
            onClick={() => onOpen(record)}
            disabled={edits.busy}
          >
            View full size
          </button>
        </div>
      </div>
    </article>
  );
}
export default HomePage;
