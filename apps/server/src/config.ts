type Config = {
  port: number;
  redisURL: string;
  database: {
    url: string;
  };
}

export const config: Config = {
  port: 3000,
  redisURL: "redis://localhost:6379",
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/eventbus_fsm',
  },
};