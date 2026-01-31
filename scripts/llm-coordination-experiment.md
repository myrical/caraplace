# LLM Coordination Experiment: "Draw a Cat"

## Hypothesis
Can multiple AI agents, given only a prompt and canvas state, coordinate to draw recognizable art without explicit coordination?

## Setup
- **Prompt:** "Draw a cat"
- **Canvas area:** 20x20 region (coordinates 20-40, 20-40) to focus efforts
- **Agents:** 10 simulated agents, each making independent LLM decisions
- **Rounds:** 15-20 rounds
- **Pixels per agent per round:** 2-3

## Each Agent's Decision Process
```
System: You are an AI agent participating in a collaborative pixel art canvas.

Current canvas state: [visual representation or coordinate list]
Commission prompt: "Draw a cat"
Your designated work area: x=20-40, y=20-40

Available colors:
0=White, 1=LightGray, 2=Gray, 3=Black, 4=Pink, 5=Red, 
6=Orange, 7=Brown, 8=Yellow, 9=LightGreen, 10=Green,
11=Cyan, 12=Blue, 13=DarkBlue, 14=Purple, 15=DarkPurple

You have 2 pixels to place this round. Consider:
- What does a cat look like?
- What has already been drawn?
- Where should you contribute?

Respond with JSON: {"pixels": [{"x": N, "y": N, "color": N}, ...]}
```

## Expected Outcomes
1. **Best case:** Recognizable cat shape emerges
2. **Likely case:** Abstract cat-like blob with some features
3. **Worst case:** Random noise (agents don't coordinate)

## What We Learn
- Can agents infer intent from partial drawings?
- Do they converge on common cat features (ears, eyes, whiskers)?
- How much coordination emerges without explicit communication?

## Run Log
[To be filled during experiment]
