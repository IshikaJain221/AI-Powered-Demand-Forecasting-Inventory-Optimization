from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/demand_forecast"
    env: str = "development"
    gemini_api_key: str = ""
    tavily_api_key: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()