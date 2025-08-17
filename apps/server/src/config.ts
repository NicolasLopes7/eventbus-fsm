type Config = {
  port: number;
  redisURL: string;
  database: {
    url: string;
  };
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3000'),
  redisURL: process.env.REDIS_URL || "redis://localhost:6379",
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/eventbus_fsm',
  },
};