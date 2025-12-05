CSE 115A – Introduction to Software Engineering

Test Plan and Report

**Document Name:** Test Plan and Report
**Product Name:** ChatCut
**Team Name:** ChatCut Team
**Date:** 2025-12-01

## System Test Scenarios

The following system test scenarios are designed to verify that each user story has been successfully implemented. Each scenario outlines the user interactions required to validate the acceptance criteria.

### 1. Visual Editing Capabilities

**User Story 1.1: Zoom Control**
As a video editor, I want to zoom in or out of a clip using natural language commands (specifying scale, duration, or animation style) so that I can quickly reframe shots without manual keyframing.

**Scenario 1.1.1: Static Zoom In (Pass/Fail)**
1. Select a video clip in the timeline.
2. Enter prompt: `"Zoom in to 150%"`
3. **Expected Result:** The clip's scale property is set to 150% constant throughout the clip (no animation).

**Scenario 1.1.2: Animated Zoom (Ken Burns) (Pass/Fail)**
1. Select a video clip.
2. Enter prompt: `"Slow zoom in to 120%"` or `"Ken Burns effect"`
3. **Expected Result:** Keyframes are added to the Scale property, animating from 100% to 120% (or default) over the clip's duration.

**User Story 1.2: Video Filters**
As a creative professional, I want to apply stylistic video filters by describing the desired look so that I can enhance the visual aesthetic of my footage effortlessly.

**Scenario 1.2.1: Apply Black & White Filter (Pass/Fail)**
1. Select a video clip.
2. Enter prompt: `"Make it black and white"`
3. **Expected Result:** The "Black & White" (or equivalent) video effect is applied to the clip.

**Scenario 1.2.2: Apply Vignette (Pass/Fail)**
1. Select a video clip.
2. Enter prompt: `"Add a vignette"`
3. **Expected Result:** A vignette effect is added to the clip.

**User Story 1.3: Transitions**
As an editor, I want to apply transitions between clips by naming them so that I can smooth out cuts without searching through effects panels.

**Scenario 1.3.1: Apply Cross Dissolve (Pass/Fail)**
1. Select the edit point between two clips (or a clip to apply to start/end).
2. Enter prompt: `"Add a cross dissolve"`
3. **Expected Result:** A cross dissolve transition is applied to the edit point/clip boundaries.

**User Story 1.4: Blur Effects**
As a user, I want to apply specific amounts of blur to clips so that I can obscure details or create depth-of-field effects.

**Scenario 1.4.1: Apply Specific Blur Amount (Pass/Fail)**
1. Select a video clip.
2. Enter prompt: `"Add blur 30"`
3. **Expected Result:** A Gaussian Blur effect is applied with the blurriness parameter set to 30.

**User Story 1.5: Parameter Modification**
As a detail-oriented editor, I want to fine-tune specific parameters of existing effects using natural language so that I can adjust settings like opacity or intensity without navigating complex menus.

**Scenario 1.5.1: Modify Effect Parameter (Pass/Fail)**
1. Select a clip that already has a "Mosaic" effect (or similar).
2. Enter prompt: `"Set mosaic blocks to 20"`
3. **Expected Result:** The existing Mosaic effect's "Horizontal Blocks" (or relevant) parameter is updated to 20.

### 2. Audio Editing Capabilities

**User Story 2.1: Volume Adjustment**
As a user, I want to adjust the audio volume of clips by specifying decibel changes so that I can balance audio levels quickly.

**Scenario 2.1.1: Increase Volume (Pass/Fail)**
1. Select an audio clip.
2. Enter prompt: `"Increase volume by 3dB"`
3. **Expected Result:** The audio clip's volume level is increased by 3 decibels.

**User Story 2.2: Audio Effects**
As a sound editor, I want to apply common audio filters (like reverb or noise reduction) by name so that I can improve audio quality without manual searching.

**Scenario 2.2.1: Apply Reverb (Pass/Fail)**
1. Select an audio clip.
2. Enter prompt: `"Add reverb"`
3. **Expected Result:** A Reverb audio effect is applied to the clip.

### 3. Advanced & Generative Features

**User Story 3.1: Generative Video Transformation**
As a content creator, I want to transform the visual style of a video file using generative AI prompts so that I can create unique artistic interpretations of my footage.

**Scenario 3.1.1: Generative Style Transfer (Pass/Fail)**
1. Select a video file on the filesystem (or provide path via input).
2. Enter prompt: `"Make it look like a charcoal drawing"`
3. **Expected Result:** The video is processed by the AI video provider (Runway), and a new video file with the applied style is generated and saved to the output directory.

**User Story 3.2: Effect Inspection**
As a user, I want to query the available parameters of a selected clip so that I know which properties are available for modification.

**Scenario 3.2.1: List Parameters (Pass/Fail)**
1. Select a clip with effects applied.
2. Enter prompt: `"What parameters can I change?"`
3. **Expected Result:** The system returns/displays a list of modifiable parameters for the currently selected clip/effects.

### 4. Interaction & Disambiguation

**User Story 4.1: Ambiguous Request Handling**
As a user, I want the system to provide a list of potential options when my request is vague so that I can choose the exact effect or transition I intended.

**Scenario 4.1.1: Ambiguous Filter Request (Pass/Fail)**
1. Select a video clip.
2. Enter prompt: `"Add a glow effect"` (or a term that matches multiple filters like "glow").
3. **Expected Result:** The system returns a response listing multiple potential matching filters (e.g., "Multiple matching filters found: AE.ADBE Alpha Glow, ...") instead of applying one arbitrarily.

### 5. User Interface & Interaction

**User Story 5.1: Sending Commands**
As a user, I want to type and send commands to the chatbot so that I can interact with the video editing AI.

**Scenario 5.1.1: Send Message via Button (Pass/Fail)**
1. Type text "Test message" in the input field.
2. Click the Send button (paper plane icon).
3. **Expected Result:** The message "Test message" appears in the chat history aligned to the right (user side), and the input field is cleared.

**Scenario 5.1.2: Send Message via Enter Key (Pass/Fail)**
1. Type text "Test enter key" in the input field.
2. Press the Enter key.
3. **Expected Result:** The message "Test enter key" appears in the chat history, and the input field is cleared.

**User Story 5.2: Context/Parameter Selection**
As a user, I want to select specific effect parameters from the active clip to provide context to the AI so that my modifications are relative to current settings.

**Scenario 5.2.1: Add Effect Context (Pass/Fail)**
1. Select a clip in the timeline that has effects (e.g., "Mosaic").
2. Click the "+" button next to the chat input.
3. Select an effect (e.g., "Mosaic") from the dropdown list.
4. **Expected Result:** A chip labeled with the effect name (e.g., "Mosaic") appears above the input field.

**Scenario 5.2.2: Send Message with Context (Pass/Fail)**
1. Ensure an effect context chip is selected (from Scenario 5.2.1).
2. Type "Increase blocks by 10" and send.
3. **Expected Result:** The system sends the message *along with* the current parameter values of the selected effect to the backend (verified by backend logs receiving `context_params` or correct relative adjustment).

**User Story 5.3: Message History**
As a user, I want to see a history of my conversation and the AI's responses so that I can track what edits have been performed.

**Scenario 5.3.1: View Chat History (Pass/Fail)**
1. Send multiple messages.
2. **Expected Result:** New messages appear at the bottom of the list, previous messages remain visible above, and the view scrolls to show the latest message.

---

**Last modified:** 2025-12-01
