"""Application settings, loaded from environment / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

_VALID_PROVIDERS = {"anthropic", "gemini", "openrouter", "template"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    openrouter_api_key: str = ""
    # OpenRouter's free catalog rotates — verify a slug is still free at
    # https://openrouter.ai/models?max_price=0 and override via OPENROUTER_MODEL.
    openrouter_model: str = "openai/gpt-oss-20b:free"
    # Optional explicit override: anthropic | gemini | openrouter | template.
    # Empty = auto-select by whichever key is configured.
    llm_provider: str = ""
    database_url: str = "sqlite:///./muster.db"
    cors_origins: str = "http://localhost:5173"

    # Auth. Set a strong SECRET_KEY in production (any long random string).
    secret_key: str = "dev-insecure-change-me-please"
    auth_token_ttl_hours: int = 168  # 7 days

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def active_provider(self) -> str:
        """Which LLM provider generation will use.

        Honors an explicit LLM_PROVIDER override; otherwise auto-selects by key
        in order: Anthropic → Gemini → OpenRouter → offline template fallback.
        """
        override = self.llm_provider.strip().lower()
        if override in _VALID_PROVIDERS:
            return override
        if self.anthropic_api_key.strip():
            return "anthropic"
        if self.gemini_api_key.strip():
            return "gemini"
        if self.openrouter_api_key.strip():
            return "openrouter"
        return "template"

    @property
    def active_model(self) -> str:
        return {
            "anthropic": self.anthropic_model,
            "gemini": self.gemini_model,
            "openrouter": self.openrouter_model,
            "template": "template-fallback",
        }[self.active_provider]


@lru_cache
def get_settings() -> Settings:
    return Settings()
