# ChatCut Architecture Evolution Plan

## Current State Analysis

**What Works:**
- Clean separation: AI extraction → action dispatch → Premiere API
- Action registry pattern (`actionDispatcher.js`) is well-structured
- Provider abstraction allows switching AI providers
- Multi-action support already implemented

**The Problem:**
- 600+ line monolithic system prompt in `gemini_provider.py`
- Hard to maintain: adding new actions requires editing massive prompt
- No structured validation of action schemas
- Prompt bloat will worsen as features grow

## Recommended Evolution Path

### Phase 1: Structured Function Calling (EASIEST WIN) ⭐

**Goal:** Replace monolithic prompt with Gemini's native function calling

**Why This First:**
- Biggest impact with minimal refactoring
- Uses Gemini's built-in structured output capabilities
- Maintains current architecture (no breaking changes)
- Immediate scalability improvement

**Implementation:**
1. Convert action definitions to JSON Schema format
2. Use Gemini's `generate_content()` with `tools` parameter
3. Let Gemini choose which "function" (action) to call with structured parameters
4. Keep the same response format (`action` + `parameters`)

**Benefits:**
- Prompt shrinks from 600+ lines to ~50 lines
- Action schemas live in code (version controlled, testable)
- Better parameter validation (schema enforces types)
- Easier to add new actions (just add to schema registry)

**Time Estimate:** 2-4 hours

---

### Phase 2: Iterative Refinement (MEDIUM TERM)

**Goal:** Add ability to refine/extend edits when initial attempt fails

**When Useful:**
- User says "make it more blurry" → AI applies blur → user says "even more" → refine
- Complex multi-step requests that need verification
- When AI is uncertain and needs to ask clarifying questions

**Implementation:**
- Add conversation context to prompts
- Track previous actions in session
- Allow follow-up prompts to reference prior edits
- Simple loop: Execute → Check result → Refine if needed

**Time Estimate:** 1-2 days

---

### Phase 3: Agent Loop (ONLY IF NEEDED)

**Goal:** Full Plan → Execute → Review cycle for complex workflows

**When Useful:**
- Multi-step workflows: "create a montage with transitions between clips"
- Conditional logic: "if clip is longer than 5s, add zoom, else add blur"
- Error recovery: automatically retry with different parameters

**Implementation:**
- Separate planning step (AI proposes sequence of actions)
- Execution step (dispatch actions sequentially)
- Review step (check results, verify success)
- Iterate until complete or max attempts reached

**Time Estimate:** 3-5 days (only if Phase 1 & 2 prove insufficient)

---

## Why NOT Start with Agent Loop?

1. **Overkill for current use case:** Most requests are single-action ("zoom in 120%")
2. **Complexity cost:** More moving parts = more bugs, harder debugging
3. **Latency:** Agent loops add multiple LLM calls (slower UX)
4. **Your current system works:** Don't fix what isn't broken

**Start simple, add complexity only when needed.**

---

## Recommended Next Steps

1. **Immediate:** Implement Phase 1 (Function Calling)
   - Extract action schemas from prompt to structured format
   - Refactor `GeminiProvider` to use `tools` parameter
   - Test with existing actions

2. **After Phase 1:** Monitor for pain points
   - Are users asking for complex multi-step edits?
   - Do we need better error recovery?
   - Is uncertainty handling sufficient?

3. **If needed:** Implement Phase 2 (Iterative Refinement)
   - Add conversation context
   - Track action history
   - Enable follow-up refinement

4. **Only if Phase 2 insufficient:** Consider Phase 3 (Agent Loop)

---

## Technical Notes

### Gemini Function Calling Format

```python
tools = [{
    "function_declarations": [{
        "name": "zoomIn",
        "description": "Zoom in on video clip",
        "parameters": {
            "type": "object",
            "properties": {
                "endScale": {
                    "type": "number",
                    "description": "Target zoom scale as percentage"
                },
                "animated": {
                    "type": "boolean",
                    "description": "Whether to animate zoom"
                }
            },
            "required": ["endScale"]
        }
    }]
}]
```

### Current vs. Proposed Flow

**Current:**
```
User Prompt → Massive System Prompt → LLM → Parse JSON → Action + Params
```

**Proposed (Phase 1):**
```
User Prompt → Function Schema → LLM (with tools) → Structured Function Call → Action + Params
```

**Proposed (Phase 2):**
```
User Prompt + Context → Function Schema → LLM → Execute → User Feedback → Refine
```

**Proposed (Phase 3):**
```
User Prompt → Plan (list of actions) → Execute Each → Review → Refine Plan → Repeat
```

---

## Conclusion

**Start with Phase 1.** It solves your immediate scalability problem with minimal risk. Only add Phase 2/3 if you discover real user needs that require them.

Your current architecture is actually quite good - you just need to modernize the AI extraction layer, not rebuild everything.



