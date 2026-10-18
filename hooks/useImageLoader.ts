import { useState, useEffect } from "react";
import { supabase } from "../supabase/client";
import { useAuth } from "./useAuth";

interface UseImageLoaderResult {
  imageUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

const ONE_HOUR = 60 * 60;

export const useImageLoader = (
  storagePath?: string,
  bucket: string = "images",
): UseImageLoaderResult => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (!storagePath) {
      setIsLoading(false);
      setImageUrl(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setImageUrl(null);
    setError(null);

    const load = () =>
      supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, ONE_HOUR)
        .then(({ data, error: apiError }) => {
          if (isMounted) {
            if (apiError) {
              console.error(
                `Error creating signed URL from ${bucket}:`,
                apiError,
              );
              setImageUrl(null);
              setError(apiError.message || "Failed to load image");
            } else if (data?.signedUrl) {
              setImageUrl(data.signedUrl);
              setError(null);
            } else {
              setError("Preview unavailable");
            }
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setError("Preview unavailable");
            setIsLoading(false);
          }
        });
    void load();
    const refresh = setInterval(() => void load(), 45 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(refresh);
    };
  }, [storagePath, bucket, session?.access_token]); // Re-run if auth token changes

  return { imageUrl, isLoading, error };
};
