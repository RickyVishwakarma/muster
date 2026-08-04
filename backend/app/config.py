"""Application settings, loaded from environment / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    database_url: str = "sqlite:///./muster.db"
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def active_provider(self) -> str:
        """Which LLM provider generation will use, given the configured keys.

        Preference order: Anthropic → Gemini → offline template fallback.
        """
        if self.anthropic_api_key.strip():
            return "anthropic"
        if self.gemini_api_key.strip():
            return "gemini"
        return "template"

    @property
    def active_model(self) -> str:
        return {
            "anthropic": self.anthropic_model,
            "gemini": self.gemini_model,
            "template": "template-fallback",
        }[self.active_provider]


@lru_cache
def get_settings() -> Settings:
    return Settings()
