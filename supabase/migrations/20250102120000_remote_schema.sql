-- Migration: Remote schema snapshot
-- Generated: 2025-01-02
-- Source: Remote Supabase database (xcjqilfhlwbykckzdzry)
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.folders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT folders_pkey PRIMARY KEY (id),
  CONSTRAINT folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.image_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  model text NOT NULL,
  params jsonb NOT NULL,
  templateId text,
  promptTextAtGen text NOT NULL,
  storage_path text NOT NULL,
  thumb_storage_path text,
  meta jsonb,
  sourceType text NOT NULL,
  folder_id uuid,
  mediaType text DEFAULT 'image'::text,
  CONSTRAINT image_records_pkey PRIMARY KEY (id),
  CONSTRAINT image_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT image_records_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id)
);

CREATE TABLE public.templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL,
  description text,
  defaultModel text NOT NULL,
  params jsonb NOT NULL,
  readonly boolean NOT NULL DEFAULT false,
  CONSTRAINT templates_pkey PRIMARY KEY (id),
  CONSTRAINT templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

