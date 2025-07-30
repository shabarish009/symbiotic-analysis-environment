"""
Confidence Scoring System
Calculates confidence scores for consensus results.
"""

import logging
import statistics
from typing import List, Dict, Tuple
from .types import ValidatedResponse, ConsensusResult
from .config import ConsensusConfig

logger = logging.getLogger(__name__)


class ConfidenceScorer:
    """Calculates confidence scores for consensus results"""
    
    def __init__(self, config: ConsensusConfig):
        self.config = config
        self.consensus_threshold = config.consensus_threshold
        self.similarity_threshold = config.similarity_threshold
    
    def calculate_consensus_score(self, validated_responses: List[ValidatedResponse]) -> float:
        """Calculate overall consensus score from validated responses"""
        valid_responses = [vr for vr in validated_responses if vr.is_valid]
        
        if len(valid_responses) < 2:
            return 0.0
        
        # Calculate different consensus metrics
        similarity_consensus = self._calculate_similarity_consensus(valid_responses)
        confidence_consensus = self._calculate_confidence_consensus(valid_responses)
        content_quality_consensus = self._calculate_content_quality_consensus(valid_responses)
        
        # Weighted combination of consensus metrics
        overall_consensus = (
            similarity_consensus * 0.5 +
            confidence_consensus * 0.3 +
            content_quality_consensus * 0.2
        )
        
        logger.debug(f"Consensus scores - similarity: {similarity_consensus:.3f}, "
                    f"confidence: {confidence_consensus:.3f}, "
                    f"content_quality: {content_quality_consensus:.3f}, "
                    f"overall: {overall_consensus:.3f}")
        
        return overall_consensus
    
    def _calculate_similarity_consensus(self, valid_responses: List[ValidatedResponse]) -> float:
        """Calculate consensus based on response similarity"""
        if len(valid_responses) < 2:
            return 0.0

        # Collect all pairwise similarities
        all_similarities = []
        for vr in valid_responses:
            similarities = list(vr.similarity_scores.values())
            all_similarities.extend(similarities)

        if not all_similarities:
            return 0.0

        # IMPROVEMENT: Enhanced similarity consensus calculation
        # Calculate average similarity with outlier detection
        avg_similarity = statistics.mean(all_similarities)

        # Calculate similarity variance to detect outliers
        if len(all_similarities) > 2:
            similarity_variance = statistics.variance(all_similarities)
            # Penalize high variance (inconsistent similarities)
            variance_penalty = min(0.3, similarity_variance)  # Cap penalty at 0.3
            avg_similarity = max(0.0, avg_similarity - variance_penalty)

        # Convert to consensus score with improved scaling
        if self.similarity_threshold > 0:
            similarity_consensus = min(1.0, avg_similarity / self.similarity_threshold)
        else:
            similarity_consensus = avg_similarity

        return similarity_consensus
    
    def _calculate_confidence_consensus(self, valid_responses: List[ValidatedResponse]) -> float:
        """Calculate consensus based on model confidence scores"""
        if not valid_responses:
            return 0.0
        
        # Get weighted confidences
        weighted_confidences = []
        total_weight = 0.0
        
        for vr in valid_responses:
            model_weight = 1.0  # Default weight, could be configured per model
            weighted_confidence = vr.response.confidence * model_weight
            weighted_confidences.append(weighted_confidence)
            total_weight += model_weight
        
        if total_weight == 0:
            return 0.0
        
        # Calculate weighted average confidence
        avg_confidence = sum(weighted_confidences) / total_weight
        
        # Calculate confidence variance (lower variance = higher consensus)
        if len(weighted_confidences) > 1:
            confidence_variance = statistics.variance(weighted_confidences)
            # Convert variance to consensus score (lower variance = higher consensus)
            variance_factor = max(0.0, 1.0 - confidence_variance)
        else:
            variance_factor = 1.0
        
        # Combine average confidence with variance factor
        confidence_consensus = avg_confidence * variance_factor
        
        return confidence_consensus
    
    def _calculate_content_quality_consensus(self, valid_responses: List[ValidatedResponse]) -> float:
        """Calculate consensus based on content quality scores"""
        if not valid_responses:
            return 0.0
        
        content_scores = [vr.content_score for vr in valid_responses]
        
        # Calculate average content quality
        avg_content_score = statistics.mean(content_scores)
        
        # Calculate content quality variance
        if len(content_scores) > 1:
            content_variance = statistics.variance(content_scores)
            # Convert variance to consensus score
            variance_factor = max(0.0, 1.0 - content_variance)
        else:
            variance_factor = 1.0
        
        # Combine average quality with variance factor
        quality_consensus = avg_content_score * variance_factor
        
        return quality_consensus
    
    def select_best_response(self, valid_responses: List[ValidatedResponse]) -> ValidatedResponse:
        """Select the best response from valid responses"""
        if not valid_responses:
            raise ValueError("No valid responses to select from")
        
        # Score each response based on multiple factors
        scored_responses = []
        
        for vr in valid_responses:
            # Calculate composite score
            score = self._calculate_response_score(vr, valid_responses)
            scored_responses.append((score, vr))
        
        # Sort by score (highest first)
        scored_responses.sort(key=lambda x: x[0], reverse=True)
        
        best_response = scored_responses[0][1]
        logger.debug(f"Selected best response from {best_response.response.model_id} "
                    f"with score {scored_responses[0][0]:.3f}")
        
        return best_response
    
    def _calculate_response_score(self, response: ValidatedResponse, 
                                all_responses: List[ValidatedResponse]) -> float:
        """Calculate composite score for a single response"""
        # Base score from model confidence and content quality
        base_score = (
            response.response.confidence * 0.4 +
            response.content_score * 0.3
        )
        
        # Similarity bonus (responses similar to others get higher scores)
        if response.similarity_scores:
            avg_similarity = statistics.mean(response.similarity_scores.values())
            similarity_bonus = avg_similarity * 0.2
        else:
            similarity_bonus = 0.0
        
        # Execution time penalty (faster responses get slight bonus)
        max_time = max(vr.response.execution_time for vr in all_responses)
        if max_time > 0:
            time_factor = 1.0 - (response.response.execution_time / max_time) * 0.1
        else:
            time_factor = 1.0
        
        final_score = (base_score + similarity_bonus) * time_factor
        
        return final_score
    
    def calculate_final_confidence(self, consensus_score: float, 
                                 supporting_responses: List[ValidatedResponse]) -> float:
        """Calculate final confidence for the consensus result"""
        if not supporting_responses:
            return 0.0
        
        # Base confidence from consensus score
        base_confidence = consensus_score
        
        # Boost confidence based on number of supporting models
        model_count_factor = min(1.0, len(supporting_responses) / self.config.min_supporting_models)
        
        # Average model confidence
        avg_model_confidence = statistics.mean(
            vr.response.confidence for vr in supporting_responses
        )
        
        # Average content quality
        avg_content_quality = statistics.mean(
            vr.content_score for vr in supporting_responses
        )
        
        # Weighted combination
        final_confidence = (
            base_confidence * 0.4 +
            model_count_factor * 0.2 +
            avg_model_confidence * 0.2 +
            avg_content_quality * 0.2
        )
        
        # Ensure confidence is within valid range
        final_confidence = max(0.0, min(1.0, final_confidence))
        
        logger.debug(f"Final confidence calculation: "
                    f"consensus={consensus_score:.3f}, "
                    f"model_count_factor={model_count_factor:.3f}, "
                    f"avg_model_conf={avg_model_confidence:.3f}, "
                    f"avg_content_qual={avg_content_quality:.3f}, "
                    f"final={final_confidence:.3f}")
        
        return final_confidence
    
    def analyze_disagreement(self, valid_responses: List[ValidatedResponse]) -> Dict:
        """Analyze the nature of disagreement between responses"""
        if len(valid_responses) < 2:
            return {'type': 'insufficient_responses', 'details': {}}
        
        # Analyze similarity patterns
        similarity_matrix = self._build_similarity_matrix(valid_responses)
        
        # Find clusters of similar responses
        clusters = self._find_similarity_clusters(valid_responses, similarity_matrix)
        
        # Analyze confidence patterns
        confidences = [vr.response.confidence for vr in valid_responses]
        confidence_variance = statistics.variance(confidences) if len(confidences) > 1 else 0.0
        
        # Analyze content quality patterns
        content_scores = [vr.content_score for vr in valid_responses]
        content_variance = statistics.variance(content_scores) if len(content_scores) > 1 else 0.0
        
        disagreement_analysis = {
            'type': 'disagreement',
            'details': {
                'num_responses': len(valid_responses),
                'num_clusters': len(clusters),
                'largest_cluster_size': max(len(cluster) for cluster in clusters) if clusters else 0,
                'confidence_variance': confidence_variance,
                'content_quality_variance': content_variance,
                'avg_similarity': statistics.mean([
                    sim for similarities in similarity_matrix.values() 
                    for sim in similarities.values()
                ]) if similarity_matrix else 0.0,
                'clusters': [
                    {
                        'size': len(cluster),
                        'models': [vr.response.model_id for vr in cluster],
                        'avg_confidence': statistics.mean(vr.response.confidence for vr in cluster)
                    }
                    for cluster in clusters
                ]
            }
        }
        
        return disagreement_analysis
    
    def _build_similarity_matrix(self, responses: List[ValidatedResponse]) -> Dict[str, Dict[str, float]]:
        """Build similarity matrix between all responses"""
        matrix = {}
        
        for vr in responses:
            matrix[vr.response.model_id] = vr.similarity_scores.copy()
        
        return matrix
    
    def _find_similarity_clusters(self, responses: List[ValidatedResponse], 
                                similarity_matrix: Dict[str, Dict[str, float]]) -> List[List[ValidatedResponse]]:
        """Find clusters of similar responses"""
        clusters = []
        used_models = set()
        
        for vr in responses:
            if vr.response.model_id in used_models:
                continue
            
            # Start a new cluster
            cluster = [vr]
            used_models.add(vr.response.model_id)
            
            # Find similar responses
            for other_vr in responses:
                if (other_vr.response.model_id not in used_models and
                    vr.response.model_id in other_vr.similarity_scores and
                    other_vr.similarity_scores[vr.response.model_id] >= self.similarity_threshold):
                    
                    cluster.append(other_vr)
                    used_models.add(other_vr.response.model_id)
            
            clusters.append(cluster)
        
        return clusters
