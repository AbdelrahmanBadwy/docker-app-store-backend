import { App } from "../../domain/models/App";
import { AppLocation } from "../../domain/valueObjects/AppLocation";
import { DockerRegistryClient } from "../registry/dockerRegistryClient";
import logger from "../../shared/logger";

// The repository interface defines the contract for what our application needs.
export interface IAppRepository {
  findAll(): Promise<App[]>;
}

// The concrete implementation of the repository for the Docker Hub use case.
export class AppRepository implements IAppRepository {
  private client: DockerRegistryClient;

  constructor(client: DockerRegistryClient) {
    this.client = client;
  }

  /**
   * Finds all application by fetching repository names from Docker Hub and then
   * getting the metadata for each one.
   */
  public async findAll(): Promise<App[]> {
    try {
      // This is the key change: calling the specific method for Docker Hub
      const repositories = await this.client.getRepositoriesFromDockerHub();
      if (!repositories) return [];

      const appPromises = repositories.map(
        async (repoName): Promise<App | null> => {
          try {
            // First, get basic repository info (which doesn't require tags)
            const repoInfo = await this.client.getRepositoryInfo(repoName);
            if (!repoInfo) {
              logger.warn(`Repository ${repoName} not found, skipping`);
              return null;
            }

            // Check if the repository has tags before trying to get manifest
            if (!repoInfo.has_tags || repoInfo.available_tags?.length === 0) {
              logger.info(
                `Repository ${repoName} has no tags, creating basic app info`
              );

              // Create a basic app with just repository information
              return {
                name: repoInfo.name || repoName,
                location: AppLocation.create(repoName),
                description: repoInfo.description || "No description provided.",
                pictureUrl: "https://via.placeholder.com/150",
              };
            }

            // Try to get manifest and config only if tags exist
            const manifest = await this.client.getManifest(repoName);
            if (!manifest) {
              logger.warn(
                `Could not get manifest for ${repoName}, using basic info`
              );

              // Fallback to basic app info
              return {
                name: repoInfo.name || repoName,
                location: AppLocation.create(repoName),
                description: repoInfo.description || "No description provided.",
                pictureUrl: "https://via.placeholder.com/150",
              };
            }

            // Check if manifest has config before trying to access it
            if (!manifest.config || !manifest.config.digest) {
              logger.warn(
                `Manifest for ${repoName} has no config, using basic info`
              );

              return {
                name: repoInfo.name || repoName,
                location: AppLocation.create(repoName),
                description: repoInfo.description || "No description provided.",
                pictureUrl: "https://via.placeholder.com/150",
              };
            }

            const config = await this.client.getConfig(
              repoName,
              manifest.config.digest
            );

            if (!config) {
              logger.warn(
                `Could not get config for ${repoName}, using basic info`
              );

              return {
                name: repoInfo.name || repoName,
                location: AppLocation.create(repoName),
                description: repoInfo.description || "No description provided.",
                pictureUrl: "https://via.placeholder.com/150",
              };
            }

            const labels = config.config?.Labels || {};

            // Map the data from labels to our structured App domain model
            // Prefer Docker labels, but fallback to repository info
            return {
              name:
                labels["org.opencontainers.image.title"] ||
                repoInfo.name ||
                repoName,
              location: AppLocation.create(repoName),
              description:
                labels["org.opencontainers.image.description"] ||
                repoInfo.description ||
                "No description provided.",
              pictureUrl:
                labels["com.app-store.picture-url"] ||
                "https://via.placeholder.com/150",
            };
          } catch (error) {
            logger.error(`Failed to process repository ${repoName}:`, error);

            // Try to create a basic app with just the repository name as a last resort
            try {
              return {
                name: repoName,
                location: AppLocation.create(repoName),
                description: "Repository information unavailable.",
                pictureUrl: "https://via.placeholder.com/150",
              };
            } catch (locationError) {
              logger.error(
                `Failed to create basic app for ${repoName}:`,
                locationError
              );
              return null; // Return null only if we can't even create a basic app
            }
          }
        }
      );

      const apps = await Promise.all(appPromises);
      // Filter out any nulls from failed repositories to return a clean list
      return apps.filter((app): app is App => app !== null);
    } catch (error) {
      logger.error("Failed to fetch the entire app catalog:", error);
      return []; // Return an empty array if the initial fetch fails
    }
  }
}
