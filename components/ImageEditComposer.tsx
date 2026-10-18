import React, { useId } from "react";
import { useImageEdits } from "../hooks/useImageEdits";
import {
  FAL_MODELS,
  getFalModel,
} from "../supabase/functions/_shared/falModels";
import { ModelId } from "../types";

export function ImageEditComposer({
  edits,
  disabled = false,
}: {
  edits: ReturnType<typeof useImageEdits>;
  disabled?: boolean;
}) {
  const id = useId();
  const locked = disabled || edits.busy;
  return (
    <form
      className="image-edit-composer"
      aria-label="Edit image"
      onSubmit={(event) => {
        event.preventDefault();
        if (!locked) void edits.sendEdit();
      }}
    >
      <label className="field-label" htmlFor={`${id}-prompt`}>
        Edit this image
      </label>
      <p className="field-hint">
        Describe a change, then keep going. Each edit uses the version you’re
        viewing.
      </p>
      <div className="image-edit-input">
        <textarea
          id={`${id}-prompt`}
          ref={edits.promptRef}
          rows={2}
          maxLength={10000}
          value={edits.prompt}
          disabled={locked}
          onChange={(event) => edits.setPrompt(event.target.value)}
          placeholder="Make the background blue…"
          aria-describedby={`${id}-hint`}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          className="primary-button"
          type="submit"
          disabled={locked || !edits.prompt.trim()}
        >
          {edits.busy ? "Editing…" : "Send edit"}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
      <div className="image-edit-options">
        <span className="field-hint" id={`${id}-hint`}>
          Enter to send · Shift + Enter for a new line
        </span>
        <details>
          <summary>Model: {getFalModel(edits.modelId)?.name}</summary>
          <label className="field-label" htmlFor={`${id}-model`}>
            Editing model
          </label>
          <select
            id={`${id}-model`}
            value={edits.modelId}
            disabled={locked}
            onChange={(event) =>
              edits.setModelId(event.target.value as ModelId)
            }
          >
            {Object.entries(FAL_MODELS)
              .filter(
                ([key, model]) =>
                  model.type === "image" && getFalModel(key)?.editEndpoint,
              )
              .map(([key, model]) => (
                <option key={key} value={key}>
                  {model.name}
                </option>
              ))}
          </select>
        </details>
      </div>
      {edits.status && (
        <p className="field-hint" role="status">
          {edits.status}
        </p>
      )}
      {edits.error && (
        <p className="inline-warning" role="alert">
          {edits.error}
        </p>
      )}
      {edits.recoveryUrl && (
        <a
          className="text-link"
          href={edits.recoveryUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Download edited original ↗
        </a>
      )}
      {edits.busy && (
        <button className="quiet-button" type="button" onClick={edits.stop}>
          Stop editing
        </button>
      )}
      {edits.versions.length > 1 && (
        <div
          className="image-edit-versions"
          role="group"
          aria-label="Saved versions"
        >
          {edits.versions.map((version, index) => (
            <button
              className="quiet-button"
              type="button"
              key={version.id}
              aria-pressed={edits.current?.id === version.id}
              disabled={locked}
              onClick={() => edits.selectVersion(version)}
              title={version.promptTextAtGen}
            >
              {index === 0 ? "Starting image" : `Edit ${index}`}
            </button>
          ))}
          <span className="field-hint">All versions saved to your library</span>
        </div>
      )}
    </form>
  );
}
