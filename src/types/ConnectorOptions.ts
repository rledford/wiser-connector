type ConnectorOptions = {
  id?: string;
  hostname?: string;
  port?: number;
  tlsEnabled?: boolean;
  tagSampleRate?: number;
  tagHeartbeat?: number;
  zoneSampleRate?: number;
};

export { ConnectorOptions };
