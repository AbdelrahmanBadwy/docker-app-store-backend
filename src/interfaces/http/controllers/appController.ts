import { Request, Response } from "express";
import { AppService } from "../../../application/services/appService";
import { AppRepository } from "../../../infrastructure/repositories/appRepository";
import { DockerRegistryClient } from "../../../infrastructure/registry/dockerRegistryClient";

// Instantiate dependencies. In a real app, you would use a Dependency Injection container.
const dockerClient = new DockerRegistryClient();
const appRepository = new AppRepository(dockerClient);
const appService = new AppService(appRepository);

export const getAllAppsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const apps = await appService.getAllApps();
  // Map domain objects to a simpler DTO for the response
  const appDTOs = apps.map((app) => ({
    name: app.name,
    location: app.location.value,
    description: app.description,
    pictureUrl: app.pictureUrl,
  }));
  res.status(200).json(appDTOs);
};
