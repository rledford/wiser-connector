type Tag = {
  tag: number;
  error: number;
  location: {
    x: number;
    y: number;
    z: number;
  };
  zones: [{ id: number }];
  battery: number;
  timestamp: number;
};

export { Tag };
