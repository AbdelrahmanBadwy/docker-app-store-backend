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
            const manifest = await this.client.getManifest(repoName);
            const config = await this.client.getConfig(
              repoName,
              manifest.config.digest
            );
            const labels = config.config.Labels || {};

            // Map the data from labels to our structured App domain model
            return {
              name: labels["org.opencontainers.image.title"] || repoName,
              location: AppLocation.create(repoName),
              description:
                labels["org.opencontainers.image.description"] ||
                "No description provided.",
              pictureUrl:
                labels["com.app-store.picture-url"] ||
                "https://via.placeholder.com/150",
            };
          } catch (error) {
            logger.error(`Failed to process repository ${repoName}:`, error);
            return null; // Return null for any repo that fails, so we don't crash the whole process
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
