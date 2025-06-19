import { App } from '../../domain/models/App';
import { IAppRepository } from '../../infrastructure/repositories/appRepository';

// This service orchestrates the use case of fetching all applications.
export class AppService {
  private appRepository: IAppRepository;

  constructor(appRepository: IAppRepository) {
    this.appRepository = appRepository;
  }

  public async getAllApps(): Promise<App[]> {
    // This method retrieves all applications from the repository.
    return this.appRepository.findAll();
  }
}