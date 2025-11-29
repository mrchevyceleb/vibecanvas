
import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from './useAuth';

interface UseImageLoaderResult {
    imageUrl: string | null;
    isLoading: boolean;
    error: string | null;
}

const FIVE_MINUTES = 5 * 60;

export const useImageLoader = (storagePath?: string, bucket: string = 'images'): UseImageLoaderResult => {
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
        setError(null);

        supabase.storage
            .from(bucket)
            .createSignedUrl(storagePath, FIVE_MINUTES)
            .then(({ data, error: apiError }) => {
                if (isMounted) {
                    if (apiError) {
                        console.error(`Error creating signed URL from ${bucket}:`, apiError);
                        setImageUrl(null);
                        setError(apiError.message || 'Failed to load image');
                    } else {
                        setImageUrl(data.signedUrl);
                        setError(null);
                    }
                    setIsLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [storagePath, bucket, session?.access_token]); // Re-run if auth token changes

    return { imageUrl, isLoading, error };
};
