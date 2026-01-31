
type HandlerKey<H> = Extract<keyof H, string>;

export type CodecWorkerHandlers = {
  init: (payload: any) => any;
  [key: string]: (payload: any) => any;
};

export type RefineHandlers<H extends CodecWorkerHandlers> = {
  init: (payload: Parameters<H["init"]>[0]) => ReturnType<H["init"]>;
} & {
  [K in keyof H as K extends "init" ? never : K]: H[K];
};

export type WorkerInboundMessage<H extends CodecWorkerHandlers> = {
  [K in HandlerKey<H>]: {
    type: K;
    id: number;
    payload: Parameters<H[K]>[0];
  };
}[HandlerKey<H>];


export type CodecWorkerMethods<H extends CodecWorkerHandlers> = {
  [K in HandlerKey<H> as K extends "init" ? never : K]: H[K] extends (
    payload: infer P,
    ...args: any[]
  ) => infer R
    ? (
        payload: P,
        transferables?: Transferable[],
      ) => Promise<R extends Promise<infer RR> ? RR : R>
    : never;
};

export type InitPayloadType<H extends CodecWorkerHandlers> = H extends {
  init: (payload: infer P, ...args: any[]) => any;
}
  ? P
  : unknown;
