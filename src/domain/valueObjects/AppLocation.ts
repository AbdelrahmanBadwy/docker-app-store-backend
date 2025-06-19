// A Value Object representing the unique location of the app in the registry.
export class AppLocation {
  public readonly value: string;

  private constructor(location: string) {
    if (!location || location.trim().length === 0) {
      throw new Error("App location cannot be empty.");
    }
    this.value = location;
  }

  public static create(location: string): AppLocation {
    return new AppLocation(location);
  }
}
