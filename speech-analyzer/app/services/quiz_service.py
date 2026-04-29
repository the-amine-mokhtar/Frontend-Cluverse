import json
import logging
import httpx
from typing import List, Dict, Any
from app.config.settings import get_settings

logger = logging.getLogger(__name__)

class QuizService:
    def __init__(self):
        self.settings = get_settings()
        self.model = "llama-3.1-8b-instant"

    async def generate_quiz(self, skill_name: str, level: int) -> Dict[str, Any]:
        """
        Generates a technical quiz using Groq LLM via direct HTTP call.
        """
        levels = {0: "Beginner", 1: "Elementary", 2: "Intermediate", 3: "Advanced", 4: "Expert", 5: "Master"}
        level_str = levels.get(level, "Intermediate")

        prompt = f"""
        Generate a technical multiple-choice quiz for the skill: '{skill_name}' at '{level_str}' level.
        The quiz must have exactly 5 questions.
        For each question, provide 4 options and the index of the correct answer (0-3).
        Include a brief explanation for the correct answer.

        Output MUST be a valid JSON object with the following structure:
        {{
          "skill": "{skill_name}",
          "level": "{level_str}",
          "questions": [
            {{
              "question": "The question text here?",
              "options": ["Option 0", "Option 1", "Option 2", "Option 3"],
              "correct_answer": 0,
              "explanation": "Brief explanation why Option 0 is correct."
            }}
          ]
        }}
        
        Important: Return ONLY the JSON, no preamble or markdown blocks.
        """

        headers = {
            "Authorization": f"Bearer {self.settings.groq_api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a technical assessment expert that outputs only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.4,
            "response_format": { "type": "json_object" }
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
                
                response.raise_for_status()
                data = response.json()
                
                content = data["choices"][0]["message"]["content"]
                quiz_data = json.loads(content)
                return quiz_data

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error generating quiz: {e.response.text}")
            raise Exception(f"Failed to generate quiz: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Error generating quiz: {str(e)}")
            raise Exception(f"Failed to generate quiz: {str(e)}")

quiz_service = QuizService()
