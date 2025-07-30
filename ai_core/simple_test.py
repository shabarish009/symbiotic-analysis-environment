#!/usr/bin/env python3
"""
Simple test for consensus engine
"""

import asyncio
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from consensus import ConsensusEngine, ConsensusConfig

async def test_consensus():
    """Simple consensus test"""
    print("Creating consensus configuration...")
    config = ConsensusConfig()
    print(f"Configuration created with {len(config.models)} models")
    
    print("Initializing consensus engine...")
    engine = ConsensusEngine(config)
    print("Consensus engine initialized")
    
    print("Testing basic query...")
    result = await engine.process_query("What is SQL?")
    
    print(f"Result status: {result.status.value}")
    print(f"Result confidence: {result.confidence}")
    print(f"Supporting models: {result.supporting_models}")
    print(f"Response: {result.response[:100]}..." if result.response else "No response")
    
    print("Test completed successfully!")

if __name__ == "__main__":
    asyncio.run(test_consensus())
