import { useState, useEffect } from "react";

export interface DirectoryUser {
  id: string;
  name: string;
  title?: string;
  company?: string;
  location?: string;
  bio?: string;
  avatar_url?: string;
  preferences: {
    mentor: boolean;
    invest: boolean;
    discuss: boolean;
    collaborate: boolean;
    hire: boolean;
  };
  connections: number;
  joinedDate: string;
}

export interface DirectoryStats {
  totalMembers: number;
  companies: number;
  locations: number;
  mentors: number;
  investors: number;
  collaborators: number;
  hiring: number;
}

export interface DirectoryFilters {
  companies: string[];
  locations: string[];
}

export interface DirectoryResponse {
  users: DirectoryUser[];
  stats: DirectoryStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  filters: DirectoryFilters;
}

export interface DirectoryParams {
  search?: string;
  company?: string;
  location?: string;
  preference?: string;
  tab?: string;
  page?: number;
  limit?: number;
}

export function useDirectory(params: DirectoryParams = {}) {
  const [data, setData] = useState<DirectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectory = async () => {
    try {
      setLoading(true);
      setError(null);

      const searchParams = new URLSearchParams();

      // Add non-empty parameters to the URL
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/directory?${searchParams.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch directory: ${response.statusText}`);
      }

      const result: DirectoryResponse = await response.json();
      setData(result);
    } catch (err) {
      console.error("Directory fetch error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch directory"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, [
    params.search,
    params.company,
    params.location,
    params.preference,
    params.tab,
    params.page,
    params.limit,
  ]);

  return {
    data,
    loading,
    error,
    refetch: fetchDirectory,
  };
}

// Hook for fetching just stats (lighter endpoint)
export function useDirectoryStats() {
  const [stats, setStats] = useState<DirectoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/directory", { method: "HEAD" });

        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.statusText}`);
        }

        const result = await response.json();
        setStats(result.stats);
      } catch (err) {
        console.error("Directory stats fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch stats");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}
