"""
Conflict Resolution System
Handles disagreements between models intelligently.
"""

import logging
import statistics
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

from .types import ValidatedResponse, ConsensusResult
from .config import ConsensusConfig

logger = logging.getLogger(__name__)


@dataclass
class ResolutionResult:
    """Result of conflict resolution attempt"""
    success: bool
    content: str
    confidence: float
    method: str
    supporting_models: List[str]
    metadata: Dict = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class ConflictResolver:
    """Resolves conflicts between model responses"""
    
    def __init__(self, config: ConsensusConfig):
        self.config = config
        self.similarity_threshold = config.similarity_threshold
        self.consensus_threshold = config.consensus_threshold
        
    def resolve_conflicts(self, valid_responses: List[ValidatedResponse]) -> ResolutionResult:
        """Attempt to resolve conflicts between responses"""
        if len(valid_responses) < 2:
            return ResolutionResult(
                success=False,
                content="",
                confidence=0.0,
                method="insufficient_responses",
                supporting_models=[]
            )
        
        logger.info(f"Attempting conflict resolution for {len(valid_responses)} responses")
        
        # Try different resolution strategies in order of preference
        resolution_strategies = [
            self._try_majority_consensus,
            self._try_weighted_consensus,
            self._try_highest_confidence,
            self._try_best_quality,
            self._try_hybrid_synthesis
        ]
        
        for strategy in resolution_strategies:
            try:
                result = strategy(valid_responses)
                if result.success:
                    logger.info(f"Conflict resolved using strategy: {result.method}")
                    return result
            except Exception as e:
                logger.warning(f"Resolution strategy {strategy.__name__} failed: {e}")
                continue
        
        # If all strategies fail, return failure
        logger.warning("All conflict resolution strategies failed")
        return ResolutionResult(
            success=False,
            content="",
            confidence=0.0,
            method="all_strategies_failed",
            supporting_models=[],
            metadata={'attempted_strategies': len(resolution_strategies)}
        )
    
    def _try_majority_consensus(self, responses: List[ValidatedResponse]) -> ResolutionResult:
        """Try to find majority consensus based on similarity clusters"""
        # Group responses by similarity
        clusters = self._find_similarity_clusters(responses)
        
        if not clusters:
            return ResolutionResult(
                success=False,
                content="",
                confidence=0.0,
                method="majority_consensus_failed",
                supporting_models=[]
            )
        
        # Find the largest cluster
        largest_cluster = max(clusters, key=len)
        cluster_size = len(largest_cluster)
        
        # IMPROVEMENT: Enhanced majority detection with minimum threshold
        majority_threshold = max(len(responses) / 2, 2)  # At least 2 models or majority
        if cluster_size < majority_threshold:
            return ResolutionResult(
                success=False,
                content="",
                confidence=0.0,
                method="no_majority_found",
                supporting_models=[],
                metadata={
                    'cluster_size': cluster_size,
                    'majority_threshold': majority_threshold,
                    'total_responses': len(responses)
                }
            )
        
        # Select best response from the majority cluster
        best_response = self._select_best_from_cluster(largest_cluster)
        
        # Calculate confidence based on cluster size and quality
        cluster_confidence = cluster_size / len(responses)
        quality_confidence = statistics.mean(vr.content_score for vr in largest_cluster)
        final_confidence = (cluster_confidence * 0.6) + (quality_confidence * 0.4)
        
        return ResolutionResult(
            success=True,
            content=best_response.response.content,
            confidence=final_confidence,
            method="majority_consensus",
            supporting_models=[vr.response.model_id for vr in largest_cluster],
            metadata={
                'cluster_size': cluster_size,
                'total_responses': len(responses),
                'cluster_confidence': cluster_confidence,
                'quality_confidence': quality_confidence
            }
        )
    
    def _try_weighted_consensus(self, responses: List[ValidatedResponse]) -> ResolutionResult:
        """Try weighted consensus based on model weights and confidence"""
        # Calculate weighted scores for each response
        weighted_responses = []
        
        for vr in responses:
            # Combine model confidence, content quality, and similarity
            avg_similarity = statistics.mean(vr.similarity_scores.values()) if vr.similarity_scores else 0.0
            
            weighted_score = (
                vr.response.confidence * 0.4 +
                vr.content_score * 0.3 +
                avg_similarity * 0.3
            )
            
            weighted_responses.append((weighted_score, vr))
        
        # Sort by weighted score
        weighted_responses.sort(key=lambda x: x[0], reverse=True)
        
        # Check if top response has sufficient weight advantage
        if len(weighted_responses) < 2:
            top_score = weighted_responses[0][0]
            second_score = 0.0
        else:
            top_score = weighted_responses[0][0]
            second_score = weighted_responses[1][0]
        
        score_advantage = top_score - second_score
        
        # Require significant advantage for weighted consensus
        if score_advantage < 0.2:
            return ResolutionResult(
                success=False,
                content="",
                confidence=0.0,
                method="insufficient_weight_advantage",
                supporting_models=[]
            )
        
        best_response = weighted_responses[0][1]
        
        return ResolutionResult(
            success=True,
            content=best_response.response.content,
            confidence=top_score,
            method="weighted_consensus",
            supporting_models=[best_response.response.model_id],
            metadata={
                'top_score': top_score,
                'second_score': second_score,
                'score_advantage': score_advantage
            }
        )
    
    def _try_highest_confidence(self, responses: List[ValidatedResponse]) -> ResolutionResult:
        """Select response with highest model confidence"""
        if not responses:
            return ResolutionResult(
                success=False,
                content="",
                confidence=0.0,
                method="no_responses",
                supporting_models=[]
            )
        
        # Sort by model confidence
        sorted_responses = sorted(responses, key=lambda vr: vr.response.confidence, reverse=True)
        best_response = sorted_responses[0]
        
        # Only succeed if confidence is reasonably high
        if best_response.response.confidence < 0.6:
            return ResolutionResult(
                success=False,
                content="",
                confidence=0.0,
                method="confidence_too_low",
                supporting_models=[]
            )
        
        return ResolutionResult(
            success=True,
            content=best_response.response.content,
            confidence=best_response.response.confidence,
            method="highest_confidence",
            supporting_models=[best_response.response.model_id],
            metadata={
                'selected_confidence': best_response.response.confidence,
                'content_score': best_response.content_score
            }
        )
    
    def _try_best_quality(self, responses: List[ValidatedResponse]) -> ResolutionResult:
        """Select response with best content quality"""
        if not responses:
            return ResolutionResult(
                success=False,
                content="",
                confidence=0.0,
                method="no_responses",
                supporting_models=[]
            )
        
        # Sort by content quality score
        sorted_responses = sorted(responses, key=lambda vr: vr.content_score, reverse=True)
        best_response = sorted_responses[0]
        
        # Only succeed if quality is reasonably high
        if best_response.content_score < self.config.min_content_score:
            return ResolutionResult(
                success=False,
                content="",
                confidence=0.0,
                method="quality_too_low",
                supporting_models=[]
            )
        
        return ResolutionResult(
            success=True,
            content=best_response.response.content,
            confidence=best_response.content_score,
            method="best_quality",
            supporting_models=[best_response.response.model_id],
            metadata={
                'selected_quality': best_response.content_score,
                'model_confidence': best_response.response.confidence
            }
        )
    
    def _try_hybrid_synthesis(self, responses: List[ValidatedResponse]) -> ResolutionResult:
        """Attempt to synthesize a hybrid response from multiple responses"""
        if len(responses) < 2:
            return ResolutionResult(
                success=False,
                content="",
                confidence=0.0,
                method="insufficient_responses_for_synthesis",
                supporting_models=[]
            )
        
        # For now, implement a simple synthesis by selecting the most comprehensive response
        # In a more advanced implementation, this could use NLP techniques to combine responses
        
        # Find response with best balance of length, quality, and confidence
        synthesis_scores = []
        
        for vr in responses:
            content_length = len(vr.response.content)
            normalized_length = min(1.0, content_length / 500)  # Normalize to 500 chars
            
            synthesis_score = (
                vr.response.confidence * 0.3 +
                vr.content_score * 0.3 +
                normalized_length * 0.2 +
                (statistics.mean(vr.similarity_scores.values()) if vr.similarity_scores else 0.0) * 0.2
            )
            
            synthesis_scores.append((synthesis_score, vr))
        
        # Sort by synthesis score
        synthesis_scores.sort(key=lambda x: x[0], reverse=True)
        best_synthesis = synthesis_scores[0][1]
        
        # Only succeed if synthesis score is reasonable
        if synthesis_scores[0][0] < 0.5:
            return ResolutionResult(
                success=False,
                content="",
                confidence=0.0,
                method="synthesis_score_too_low",
                supporting_models=[]
            )
        
        return ResolutionResult(
            success=True,
            content=best_synthesis.response.content,
            confidence=synthesis_scores[0][0],
            method="hybrid_synthesis",
            supporting_models=[best_synthesis.response.model_id],
            metadata={
                'synthesis_score': synthesis_scores[0][0],
                'content_length': len(best_synthesis.response.content),
                'num_candidates': len(responses)
            }
        )
    
    def _find_similarity_clusters(self, responses: List[ValidatedResponse]) -> List[List[ValidatedResponse]]:
        """Find clusters of similar responses"""
        clusters = []
        used_responses = set()
        
        for vr in responses:
            if id(vr) in used_responses:
                continue
            
            # Start new cluster
            cluster = [vr]
            used_responses.add(id(vr))
            
            # Find similar responses
            for other_vr in responses:
                if (id(other_vr) not in used_responses and
                    vr.response.model_id in other_vr.similarity_scores and
                    other_vr.similarity_scores[vr.response.model_id] >= self.similarity_threshold):
                    
                    cluster.append(other_vr)
                    used_responses.add(id(other_vr))
            
            clusters.append(cluster)
        
        return clusters
    
    def _select_best_from_cluster(self, cluster: List[ValidatedResponse]) -> ValidatedResponse:
        """Select the best response from a cluster"""
        if len(cluster) == 1:
            return cluster[0]
        
        # Score each response in the cluster
        scored_responses = []
        
        for vr in cluster:
            score = (
                vr.response.confidence * 0.5 +
                vr.content_score * 0.5
            )
            scored_responses.append((score, vr))
        
        # Return highest scoring response
        scored_responses.sort(key=lambda x: x[0], reverse=True)
        return scored_responses[0][1]
