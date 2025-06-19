import axios from "axios";
import { config } from "../../shared/config";
import logger from "../../shared/logger";

// This is the specific user or organization on Docker Hub
const DOCKER_HUB_NAMESPACE = "abdelrahmanelbadawy9";

// Base URL for the Docker Registry V2 API (for manifests and configs)
const REGISTRY_API_BASE_URL = "https://registry-1.docker.io/v2";

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
   * Fetches the manifest for a given repository. This uses the standard V2 Registry API.
   */
  public async getManifest(repo: string, tag: string = "latest"): Promise<any> {
    logger.info(`Fetching manifest for ${repo}:${tag} from Docker Registry`);
    
    try {
      const token = await this.getDockerHubAuthToken(repo);
      const response = await axios.get(
        `${REGISTRY_API_BASE_URL}/${repo}/manifests/${tag}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json"
          },
        }
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to process repository ${repo}:`, error);
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
      const token = await this.getDockerHubAuthToken(repo);
      const response = await axios.get(
        `${REGISTRY_API_BASE_URL}/${repo}/blobs/${digest}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.docker.distribution.manifest.v2+json"
          },
        }
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch config blob for ${repo}:`, error);
      throw error;
    }
  }

  /**
   * Helper function to get a temporary public auth token for a repository.
   */
  private async getDockerHubAuthToken(repo: string): Promise<string> {
    try {
      const authUrl = `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull`;
      const response = await axios.get(authUrl);
      return response.data.token;
    } catch (error) {
      logger.error(`Failed to get auth token for ${repo}:`, error);
      throw error;
    }
  }
}