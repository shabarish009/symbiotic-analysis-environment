"""
Response Validation System
Validates and analyzes model responses for consensus generation.
"""

import re
import logging
from typing import List, Dict, Set
from difflib import SequenceMatcher

from .types import ModelResponse, ValidatedResponse
from .config import ConsensusConfig

logger = logging.getLogger(__name__)


class ContentValidator:
    """Validates the content quality of model responses"""
    
    def __init__(self, config: ConsensusConfig):
        self.config = config
        self.min_length = config.min_response_length
        self.max_length = config.max_response_length
        
    def validate(self, content: str) -> float:
        """Validate content and return quality score (0.0 to 1.0)"""
        if not content or not content.strip():
            return 0.0
        
        content = content.strip()
        score = 1.0
        
        # Length validation
        length_score = self._validate_length(content)
        score *= length_score
        
        # Content structure validation
        structure_score = self._validate_structure(content)
        score *= structure_score
        
        # Language quality validation
        language_score = self._validate_language_quality(content)
        score *= language_score
        
        # Coherence validation
        coherence_score = self._validate_coherence(content)
        score *= coherence_score
        
        return max(0.0, min(1.0, score))
    
    def _validate_length(self, content: str) -> float:
        """Validate response length"""
        length = len(content)
        
        if length < self.min_length:
            return length / self.min_length
        elif length > self.max_length:
            return max(0.5, 1.0 - (length - self.max_length) / self.max_length)
        else:
            return 1.0
    
    def _validate_structure(self, content: str) -> float:
        """Validate content structure and formatting"""
        score = 1.0
        
        # Check for basic sentence structure
        sentences = re.split(r'[.!?]+', content)
        valid_sentences = [s.strip() for s in sentences if len(s.strip()) > 5]
        
        if len(valid_sentences) == 0:
            return 0.2
        
        # Penalize very short responses with only one sentence
        if len(valid_sentences) == 1 and len(content) < 50:
            score *= 0.7
        
        # Check for proper capitalization
        if not content[0].isupper():
            score *= 0.9
        
        # Check for excessive repetition
        words = content.lower().split()
        if len(words) > 0:
            unique_words = set(words)
            repetition_ratio = len(unique_words) / len(words)
            if repetition_ratio < 0.5:
                score *= repetition_ratio
        
        return score
    
    def _validate_language_quality(self, content: str) -> float:
        """Validate language quality and grammar"""
        score = 1.0
        
        # Check for excessive special characters
        special_char_ratio = len(re.findall(r'[^a-zA-Z0-9\s.,!?;:\-()]', content)) / len(content)
        if special_char_ratio > 0.1:
            score *= (1.0 - special_char_ratio)
        
        # Check for proper word formation
        words = re.findall(r'\b[a-zA-Z]+\b', content)
        if words:
            # Penalize responses with too many very short or very long words
            avg_word_length = sum(len(word) for word in words) / len(words)
            if avg_word_length < 3 or avg_word_length > 12:
                score *= 0.8
        
        # Check for balanced punctuation
        open_parens = content.count('(')
        close_parens = content.count(')')
        if open_parens != close_parens:
            score *= 0.9
        
        return score
    
    def _validate_coherence(self, content: str) -> float:
        """Validate logical coherence and flow"""
        score = 1.0
        
        # Check for contradictory statements (basic heuristic)
        content_lower = content.lower()
        
        # Look for obvious contradictions
        contradictions = [
            ('yes', 'no'),
            ('true', 'false'),
            ('always', 'never'),
            ('all', 'none'),
            ('possible', 'impossible')
        ]
        
        for pos, neg in contradictions:
            if pos in content_lower and neg in content_lower:
                # Check if they're in close proximity (might indicate contradiction)
                pos_idx = content_lower.find(pos)
                neg_idx = content_lower.find(neg)
                if abs(pos_idx - neg_idx) < 100:  # Within 100 characters
                    score *= 0.8
                    break
        
        return score


class SemanticSimilarityAnalyzer:
    """Analyzes semantic similarity between responses"""
    
    def __init__(self, config: ConsensusConfig):
        self.config = config
        self.similarity_threshold = config.similarity_threshold
    
    def compare_with_others(self, response: ModelResponse, 
                          all_responses: List[ModelResponse]) -> Dict[str, float]:
        """Compare response with all other responses"""
        similarities = {}
        
        for other_response in all_responses:
            if other_response.model_id != response.model_id and other_response.is_valid:
                similarity = self._calculate_similarity(response.content, other_response.content)
                similarities[other_response.model_id] = similarity
        
        return similarities
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts"""
        if not text1.strip() or not text2.strip():
            return 0.0
        
        # Normalize texts
        text1_norm = self._normalize_text(text1)
        text2_norm = self._normalize_text(text2)
        
        # Calculate different similarity metrics
        sequence_sim = self._sequence_similarity(text1_norm, text2_norm)
        word_sim = self._word_overlap_similarity(text1_norm, text2_norm)
        structure_sim = self._structural_similarity(text1, text2)
        
        # Weighted combination
        final_similarity = (
            sequence_sim * 0.4 +
            word_sim * 0.4 +
            structure_sim * 0.2
        )
        
        return final_similarity
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for comparison"""
        # Convert to lowercase
        text = text.lower()
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove punctuation for word-level comparison
        text = re.sub(r'[^\w\s]', '', text)
        
        return text.strip()
    
    def _sequence_similarity(self, text1: str, text2: str) -> float:
        """Calculate sequence similarity using difflib"""
        return SequenceMatcher(None, text1, text2).ratio()
    
    def _word_overlap_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity based on word overlap"""
        words1 = set(text1.split())
        words2 = set(text2.split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    def _structural_similarity(self, text1: str, text2: str) -> float:
        """Calculate structural similarity"""
        # Compare sentence count
        sentences1 = len(re.split(r'[.!?]+', text1))
        sentences2 = len(re.split(r'[.!?]+', text2))
        
        sentence_sim = 1.0 - abs(sentences1 - sentences2) / max(sentences1, sentences2, 1)
        
        # Compare length
        len1, len2 = len(text1), len(text2)
        length_sim = 1.0 - abs(len1 - len2) / max(len1, len2, 1)
        
        return (sentence_sim + length_sim) / 2


class ResponseValidator:
    """Main response validation coordinator"""
    
    def __init__(self, config: ConsensusConfig):
        self.config = config
        self.content_validator = ContentValidator(config)
        self.similarity_analyzer = SemanticSimilarityAnalyzer(config)
    
    def validate_responses(self, responses: List[ModelResponse]) -> List[ValidatedResponse]:
        """Validate and analyze all model responses"""
        logger.info(f"Validating {len(responses)} model responses")
        
        validated_responses = []
        
        for response in responses:
            # Skip invalid responses
            if not response.is_valid:
                validated_response = ValidatedResponse(
                    response=response,
                    content_score=0.0,
                    similarity_scores={},
                    is_valid=False,
                    validation_metadata={'reason': 'Invalid model response'}
                )
                validated_responses.append(validated_response)
                continue
            
            # Validate content quality
            content_score = self.content_validator.validate(response.content)
            
            # Calculate similarity with other responses
            similarity_scores = self.similarity_analyzer.compare_with_others(response, responses)
            
            # Determine if response meets validation criteria
            is_valid = (
                content_score >= self.config.min_content_score and
                response.is_valid
            )
            
            # Create validation metadata
            validation_metadata = {
                'content_length': len(response.content),
                'word_count': len(response.content.split()),
                'avg_similarity': sum(similarity_scores.values()) / len(similarity_scores) if similarity_scores else 0.0,
                'max_similarity': max(similarity_scores.values()) if similarity_scores else 0.0,
                'min_similarity': min(similarity_scores.values()) if similarity_scores else 0.0
            }
            
            validated_response = ValidatedResponse(
                response=response,
                content_score=content_score,
                similarity_scores=similarity_scores,
                is_valid=is_valid,
                validation_metadata=validation_metadata
            )
            
            validated_responses.append(validated_response)
            
            logger.debug(f"Validated response from {response.model_id}: "
                        f"content_score={content_score:.3f}, "
                        f"is_valid={is_valid}, "
                        f"avg_similarity={validation_metadata['avg_similarity']:.3f}")
        
        valid_count = sum(1 for vr in validated_responses if vr.is_valid)
        logger.info(f"Validation complete: {valid_count}/{len(validated_responses)} responses are valid")
        
        return validated_responses
    
    def get_validation_summary(self, validated_responses: List[ValidatedResponse]) -> Dict:
        """Get summary of validation results"""
        valid_responses = [vr for vr in validated_responses if vr.is_valid]
        
        if not valid_responses:
            return {
                'total_responses': len(validated_responses),
                'valid_responses': 0,
                'avg_content_score': 0.0,
                'avg_similarity': 0.0,
                'validation_rate': 0.0
            }
        
        avg_content_score = sum(vr.content_score for vr in valid_responses) / len(valid_responses)
        
        all_similarities = []
        for vr in valid_responses:
            all_similarities.extend(vr.similarity_scores.values())
        
        avg_similarity = sum(all_similarities) / len(all_similarities) if all_similarities else 0.0
        
        return {
            'total_responses': len(validated_responses),
            'valid_responses': len(valid_responses),
            'avg_content_score': avg_content_score,
            'avg_similarity': avg_similarity,
            'validation_rate': len(valid_responses) / len(validated_responses)
        }
