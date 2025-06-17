import { HandlerCallback } from './handlerCallback.js';
import { AnyRouter, Manifest } from '@tanstack/router-core';
export type RequestHandler<TRouter extends AnyRouter> = (cb: HandlerCallback<TRouter>) => Promise<Response>;
export declare function createRequestHandler<TRouter extends AnyRouter>({ createRouter, request, getRouterManifest, }: {
    createRouter: () => TRouter;
    request: Request;
    getRouterManifest?: () => Manifest | Promise<Manifest>;
}): RequestHandler<TRouter>;
