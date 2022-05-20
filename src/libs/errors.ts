export class EntityNotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`Count not find ${entity} with identifier ${id}`)
  }
}
