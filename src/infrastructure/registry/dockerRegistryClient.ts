import axios from "axios";
import { config } from "../../shared/config";
import logger from "../../shared/logger";

// This is the specific user or organization on Docker Hub
const DOCKER_HUB_NAMESPACE = "abdelrahmanelbadawy1";

// Base URL for the Docker Registry V2 API (for manifests and configs)
const REGISTRY_API_BASE_URL = "https://registry-1.docker.io/v2";

// Interface for repository information
interface RepositoryInfo {
  name: string;
  description?: string;
  star_count?: number;
  pull_count?: number;
  last_updated?: string;
  is_private?: boolean;
  has_tags?: boolean;
  available_tags?: string[];
}

// This class handles both Docker Hub's API and the standard V2 Registry API
export class DockerRegistryClient {
  /**
   * Fetches repositories specifically from Docker Hub for a given user/organization.
   * It handles pagination to get all results.
   */
  public async getRepositoriesFromDockerHub(): Promise<string[]> {
    logger.info(
      `Fetching repositories for namespace [${DOCKER_HUB_NAMESPACE}] from Docker Hub`
    );

    let repositories: { name: string }[] = [];
    let nextUrl:
      | string
      | null = `https://hub.docker.com/v2/repositories/${DOCKER_HUB_NAMESPACE}/?page_size=100`;

    try {
      // Loop until there are no more pages
      while (nextUrl) {
        logger.info(`Fetching page: ${nextUrl}`);
        const response = await axios.get(nextUrl);
        const data = response.data as any;

        repositories = repositories.concat(data.results);
        nextUrl = data.next; // Get the URL for the next page, or null if it's the last page
      }

      // We need to return an array of full repository names
      return repositories.map((repo) => `${DOCKER_HUB_NAMESPACE}/${repo.name}`);
    } catch (error) {
      logger.error(
        `Failed to fetch repositories from Docker Hub for namespace ${DOCKER_HUB_NAMESPACE}`,
        error
      );
      return [];
    }
  }

  /**
   * Gets basic repository information without requiring tags
   */
  public async getRepositoryInfo(repo: string): Promise<RepositoryInfo | null> {
    logger.info(`Fetching repository info for ${repo} from Docker Hub`);

    try {
      const response = await axios.get(
        `https://hub.docker.com/v2/repositories/${repo}/`
      );

      const data = response.data;

      // Get available tags (but don't fail if there are none)
      const tags = await this.getRepositoryTags(repo);

      return {
        name: data.name,
        description: data.description,
        star_count: data.star_count,
        pull_count: data.pull_count,
        last_updated: data.last_updated,
        is_private: data.is_private,
        has_tags: tags.length > 0,
        available_tags: tags,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.warn(`Repository ${repo} does not exist on Docker Hub`);
        return null;
      }
      logger.error(
        `Failed to fetch repository info for ${repo}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Fetches the manifest for a given repository. This uses the standard V2 Registry API.
   * If no tag is specified, it will try to find an available tag.
   * Now handles cases where no tags exist gracefully.
   */
  public async getManifest(repo: string, tag?: string): Promise<any> {
    // If no tag specified, try to find an available one
    if (!tag) {
      const tags = await this.getRepositoryTags(repo);
      if (tags.length === 0) {
        logger.warn(
          `No tags found for repository ${repo}, cannot fetch manifest`
        );
        return null; // Return null instead of throwing error
      }
      // Prefer 'latest' if it exists, otherwise use the first tag
      tag = tags.includes("latest") ? "latest" : tags[0];
      logger.info(`No tag specified for ${repo}, using: ${tag}`);
    }

    logger.info(`Fetching manifest for ${repo}:${tag} from Docker Registry`);

    try {
      // First, try without authentication for public repositories
      try {
        const response = await axios.get(
          `${REGISTRY_API_BASE_URL}/${repo}/manifests/${tag}`,
          {
            headers: {
              Accept:
                "application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json",
            },
          }
        );
        return response.data;
      } catch (error: any) {
        // If we get a 401, try with authentication
        if (error.response?.status === 401) {
          logger.info(
            `Repository ${repo} requires authentication, attempting with token...`
          );
          const token = await this.getDockerHubAuthToken(repo);
          const response = await axios.get(
            `${REGISTRY_API_BASE_URL}/${repo}/manifests/${tag}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept:
                  "application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json",
              },
            }
          );
          return response.data;
        } else if (error.response?.status === 404) {
          // If tag not found, suggest available tags
          const availableTags = await this.getRepositoryTags(repo);
          throw new Error(
            `Tag '${tag}' not found for repository ${repo}. Available tags: ${availableTags.join(
              ", "
            )}`
          );
        }
        throw error;
      }
    } catch (error: any) {
      logger.error(`Failed to process repository ${repo}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        url: error.config?.url,
        tag: tag,
      });
      throw error;
    }
  }

  /**
   * Fetches the config blob for a given repository digest.
   */
  public async getConfig(repo: string, digest: string): Promise<any> {
    logger.info(
      `Fetching config blob ${digest} for ${repo} from Docker Registry`
    );

    try {
      // First, try without authentication for public repositories
      try {
        const response = await axios.get(
          `${REGISTRY_API_BASE_URL}/${repo}/blobs/${digest}`,
          {
            headers: {
              Accept: "application/vnd.docker.container.image.v1+json",
            },
          }
        );
        return response.data;
      } catch (error: any) {
        // If we get a 401, try with authentication
        if (error.response?.status === 401) {
          logger.info(
            `Repository ${repo} requires authentication for blob access, attempting with token...`
          );
          const token = await this.getDockerHubAuthToken(repo);
          const response = await axios.get(
            `${REGISTRY_API_BASE_URL}/${repo}/blobs/${digest}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.docker.container.image.v1+json",
              },
            }
          );
          return response.data;
        }
        throw error;
      }
    } catch (error: any) {
      logger.error(`Failed to fetch config blob for ${repo}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * Helper function to get a temporary public auth token for a repository.
   * This handles the Docker Hub authentication flow properly.
   */
  private async getDockerHubAuthToken(repo: string): Promise<string> {
    try {
      // The correct Docker Hub auth endpoint with proper scope
      const authUrl = `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull`;

      logger.info(`Requesting auth token for ${repo} from: ${authUrl}`);

      const response = await axios.get(authUrl, {
        headers: {
          "User-Agent": "Docker Registry Client",
        },
      });

      if (!response.data.token) {
        throw new Error("No token received from Docker Hub auth service");
      }

      logger.info(`Successfully obtained auth token for ${repo}`);
      return response.data.token;
    } catch (error: any) {
      logger.error(`Failed to get auth token for ${repo}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        url: error.config?.url,
      });
      throw error;
    }
  }

  /**
   * Get available tags for a repository using Docker Hub API
   * Returns empty array if no tags found (doesn't throw error)
   */
  public async getRepositoryTags(repo: string): Promise<string[]> {
    try {
      const response = await axios.get(
        `https://hub.docker.com/v2/repositories/${repo}/tags/?page_size=100`
      );
      return response.data.results.map((tag: any) => tag.name);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.info(`No tags found for repository ${repo}`);
        return [];
      }
      logger.error(`Failed to get tags for repository ${repo}:`, error.message);
      return [];
    }
  }

  /**
   * Check if a repository exists by trying to fetch its information
   */
  public async checkRepositoryExists(repo: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `https://hub.docker.com/v2/repositories/${repo}/`
      );
      return response.status === 200;
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.warn(`Repository ${repo} does not exist on Docker Hub`);
        return false;
      }
      logger.error(
        `Error checking repository existence for ${repo}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * Gets the manifest using the first available tag if no specific tag is provided
   * Returns null if no tags are available
   */
  public async getManifestWithAnyTag(
    repo: string
  ): Promise<{ manifest: any; tag: string } | null> {
    const tags = await this.getRepositoryTags(repo);

    if (tags.length === 0) {
      logger.warn(`No tags found for repository ${repo}, cannot get manifest`);
      return null;
    }

    // Prefer 'latest' if it exists, otherwise use the first tag
    const selectedTag = tags.includes("latest") ? "latest" : tags[0];

    logger.info(
      `Using tag '${selectedTag}' for repository ${repo}. Available tags: ${tags.join(
        ", "
      )}`
    );

    const manifest = await this.getManifest(repo, selectedTag);
    if (!manifest) {
      return null;
    }

    return { manifest, tag: selectedTag };
  }

  public async testRepositoryAccess(
    repo: string
  ): Promise<{ exists: boolean; tags: string[]; error?: string }> {
    try {
      // First check if the repository exists
      const exists = await this.checkRepositoryExists(repo);
      if (!exists) {
        return { exists: false, tags: [], error: "Repository does not exist" };
      }

      // Get available tags
      const tags = await this.getRepositoryTags(repo);
      if (tags.length === 0) {
        return { exists: true, tags: [], error: "No tags found" };
      }

      // Try to get manifest for the first available tag (or 'latest' if it exists)
      const tagToTest = tags.includes("latest") ? "latest" : tags[0];
      try {
        await this.getManifest(repo, tagToTest);
        return { exists: true, tags };
      } catch (error: any) {
        return {
          exists: true,
          tags,
          error: `Failed to access manifest: ${error.message}`,
        };
      }
    } catch (error: any) {
      return { exists: false, tags: [], error: error.message };
    }
  }
}
