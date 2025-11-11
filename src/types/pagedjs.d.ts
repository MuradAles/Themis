declare module 'pagedjs' {
  export class Previewer {
    preview(content: string, stylesheets: string[], container: HTMLElement): Promise<any>;
    destroy?(): void;
  }
}

