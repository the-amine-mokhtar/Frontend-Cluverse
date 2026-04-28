import logging
import json
from typing import List, Optional
from openai import AsyncOpenAI
from app.config.settings import get_settings
from app.models.schemas import CVAnalysisResponse, LearningPathResponse, LearningResource

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
Tu es un expert en recrutement et en gestion des talents. 
Analyse le CV fourni et :
1. Identifie les compétences clés (hard et soft skills) avec un niveau estimé de 1 à 5.
2. Pour chaque compétence, donne une catégorie (SOFT, HARD, TECHNICAL) et une brève raison basée sur le CV.
3. Rédige une description globale (2-3 phrases) qui résume le profil du candidat.

Réponds UNIQUEMENT au format JSON avec cette structure :
{
  "suggested_competencies": [
    {"name": "Java", "level": 4, "category": "TECHNICAL", "reason": "3 ans d'expérience chez X"},
    ...
  ],
  "overall_description": "Profil expérimenté en développement backend..."
}
"""

class CVService:
    def __init__(self):
        settings = get_settings()
        self.client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1"
        )
        self.model = settings.llm_model

    async def analyze_cv_text(self, text: str) -> CVAnalysisResponse:
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Voici le texte du CV :\n\n{text[:10000]}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            content = response.choices[0].message.content
            data = json.loads(content)
            return CVAnalysisResponse(**data)
        except Exception as e:
            logger.error(f"Error analyzing CV with Groq: {e}")
            raise e

    async def generate_learning_path(self, skill_name: str, target_level: int) -> LearningPathResponse:
        """Use LLM to generate a personalized learning path with real resource links."""
        
        prompt = f"""
        Generate a personalized learning path for the skill "{skill_name}" to reach level {target_level}/5.
        
        CRITICAL CONSTRAINTS for URLs:
        - MANDATORY: Include at least 2 REAL YouTube videos from famous channels (e.g. FreeCodeCamp, HubSpot, Fireship, Google Career).
        - For Courses: Use Coursera, Udemy, or HubSpot Academy.
        - For Articles: Use Medium, Dev.to or official documentation.
        - Ensure the 'platform' matches the 'url' domain.
        
        Return a JSON object with:
        - "skill_name": "{skill_name}"
        - "target_level": {target_level}
        - "estimated_time": "e.g., 6 weeks"
        - "resources": A list of 5-8 high-quality resources.
        
        Each resource must have:
        - "title": Clear title
        - "url": VALID URL
        - "youtube_id": If YouTube, extract the ID. Otherwise null.
        - "search_query": A specific YouTube search string (e.g., "HubSpot Academy social media management course")
        - "type": "VIDEO", "ARTICLE", or "COURSE"
        - "platform": "YouTube", "HubSpot", "Coursera", etc.
        - "description": Why this is good.

        IMPORTANT: Double-check the YouTube IDs. They must be real and work.
        """
        
        try:
            chat_completion = await self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are an expert technical career coach and educational researcher. You provide real, high-quality learning links. Respond ONLY with a valid JSON object."},
                    {"role": "user", "content": prompt}
                ],
                model=self.model,
                response_format={"type": "json_object"}
            )
            
            content = chat_completion.choices[0].message.content
            logger.info(f"Raw LLM Response for Learning Path: {content}")
            
            data = json.loads(content)
            
            # Normalize keys and handle nulls
            resources = data.get("learning_path", data.get("resources", []))
            normalized_resources = []
            
            for res in resources:
                # Normalize internal keys
                if "searchQuery" in res: res["search_query"] = res.pop("searchQuery")
                if "youtubeId" in res: res["youtube_id"] = res.pop("youtubeId")
                if "resource_id" in res: res.pop("resource_id") 
                
                # Ensure strings are not null
                res["search_query"] = res.get("search_query") or ""
                res["youtube_id"] = res.get("youtube_id") or ""
                res["url"] = res.get("url") or "#"
                res["type"] = (res.get("type") or "VIDEO").upper()
                normalized_resources.append(res)
            
            data["resources"] = normalized_resources
            
            if "skillName" in data: data["skill_name"] = data.pop("skillName")
            if "targetLevel" in data: data["target_level"] = data.pop("targetLevel")
            if "estimatedTime" in data: data["estimated_time"] = data.pop("estimatedTime")
            
            return LearningPathResponse(**data)
        except Exception as e:
            logger.error(f"Error generating learning path: {str(e)}")
            if 'content' in locals():
                logger.error(f"Failed content: {content}")
            raise e

cv_service = CVService()
