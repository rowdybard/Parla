/*
 * ============================================================
 * PARLA — MISSION RENDERER
 * ============================================================
 *
 * Moteur commun de rendu des activités.
 *
 * Ce fichier sera utilisé par :
 *   - activite.html → Preview
 *   - membre.html  → espace apprenant
 *
 * IMPORTANT :
 * Ce fichier ne contient aucun CSS global.
 * Les styles propres aux activités seront ajoutés séparément.
 *
 * ============================================================
 */

(function () {

  "use strict";

  /*
   * ------------------------------------------------------------
   * État interne du moteur
   * ------------------------------------------------------------
   */

  const rendererState = {
    ordering: {},
    buildSentence: {}
  };


  /*
   * ------------------------------------------------------------
   * Échappement HTML
   * ------------------------------------------------------------
   */

  function escapeHtml(value) {

    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  /*
   * ------------------------------------------------------------
   * YouTube
   * ------------------------------------------------------------
   */

  function convertYoutubeUrl(url) {

    if (!url) {
      return "";
    }

    try {

      const parsed = new URL(url);

      if (
        parsed.hostname.includes("youtube.com")
      ) {

        const videoId =
          parsed.searchParams.get("v");

        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }
      }

      if (
        parsed.hostname === "youtu.be"
      ) {

        const videoId =
          parsed.pathname.replace("/", "");

        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }
      }

    } catch (error) {

      return "";

    }

    return "";
  }


  /*
   * ------------------------------------------------------------
   * Rendu d'un élément
   * ------------------------------------------------------------
   */

  function renderElement(element, options = {}) {

    if (!element) {
      return "";
    }

    const elementIndex =
      Number.isInteger(options.elementIndex)
        ? options.elementIndex
        : 0;

    const cardKey =
      options.cardKey !== undefined
        ? options.cardKey
        : "default";


    /*
     * ----------------------------------------------------------
     * TEXT
     * ----------------------------------------------------------
     */

    if (element.type === "text") {

      return `
        <div class="mission-text">
          ${element.content || ""}
        </div>
      `;
    }


    /*
     * ----------------------------------------------------------
     * EXPLANATION
     * ----------------------------------------------------------
     */

    if (element.type === "explanation") {

      return `
        <div class="mission-explanation">
          ${element.content || ""}
        </div>
      `;
    }


    /*
     * ----------------------------------------------------------
     * QUESTION
     * ----------------------------------------------------------
     */

    if (element.type === "question") {

      return `
        <div class="mission-question">
          <strong>
            ${escapeHtml(element.question || "")}
          </strong>

          <div class="mission-question-answer">
            ${escapeHtml(element.answer || "")}
          </div>
        </div>
      `;
    }


    /*
     * ----------------------------------------------------------
     * IMAGE
     * ----------------------------------------------------------
     */

    if (element.type === "image") {

      return `
        <img
          class="media-preview"
          src="${escapeHtml(element.url || element.src || "")}"
          alt="${escapeHtml(element.alt || "")}">
      `;
    }


    /*
     * ----------------------------------------------------------
     * AUDIO
     * ----------------------------------------------------------
     */

    if (element.type === "audio") {

      return `
        <audio
          controls
          class="mission-audio"
          style="width:100%;">

          <source
            src="${escapeHtml(element.url || element.src || "")}">

          Your browser does not support audio.

        </audio>
      `;
    }


    /*
     * ----------------------------------------------------------
     * YOUTUBE
     * ----------------------------------------------------------
     */

    if (element.type === "youtube") {

      const embedUrl =
        convertYoutubeUrl(element.url);

      if (!embedUrl) {
        return `
          <div class="mission-error">
            Invalid YouTube URL.
          </div>
        `;
      }

      return `
        <iframe
          class="mission-youtube"
          src="${escapeHtml(embedUrl)}"
          allowfullscreen>
        </iframe>
      `;
    }


    /*
     * ----------------------------------------------------------
     * TRUE / FALSE
     * ----------------------------------------------------------
     */

    if (element.type === "true_false") {

      return `
        <div
          class="mission-exercise"
          data-type="true_false"
          data-element-index="${elementIndex}">

          <strong>
            ${escapeHtml(element.statement || "")}
          </strong>

          <div class="mission-options">

            <label class="mission-option">
              <input
                type="radio"
                name="mission-tf-${cardKey}-${elementIndex}"
                value="true">

              <span>True</span>
            </label>

            <label class="mission-option">
              <input
                type="radio"
                name="mission-tf-${cardKey}-${elementIndex}"
                value="false">

              <span>False</span>
            </label>

          </div>

          <button
            type="button"
            class="mission-check-btn"
            data-action="check-true-false">

            Check answer

          </button>

          <div class="mission-feedback"></div>

        </div>
      `;
    }


    /*
     * ----------------------------------------------------------
     * MULTIPLE CHOICE
     * ----------------------------------------------------------
     */

    if (element.type === "multiple_choice") {

      const options =
        (element.options || []).filter(
          option =>
            option.text &&
            option.text.trim()
        );

      return `
        <div
          class="mission-exercise"
          data-type="multiple_choice"
          data-element-index="${elementIndex}">

          <strong>
            ${escapeHtml(element.question || "")}
          </strong>

          <div class="mission-options">

            ${options.map((option, optionIndex) => `

              <label class="mission-option">

                <input
                  type="checkbox"
                  name="mission-mcq-${cardKey}-${elementIndex}"
                  value="${escapeHtml(option.id)}">

                <span>

                  <strong>
                    ${String.fromCharCode(65 + optionIndex)}.
                  </strong>

                  ${escapeHtml(option.text)}

                </span>

              </label>

            `).join("")}

          </div>

          <button
            type="button"
            class="mission-check-btn"
            data-action="check-multiple-choice">

            Check answer

          </button>

          <div class="mission-feedback"></div>

        </div>
      `;
    }


    /*
     * ----------------------------------------------------------
     * ORDERING
     * ----------------------------------------------------------
     */

    if (element.type === "ordering") {

      const orderingKey =
        `${cardKey}_${elementIndex}`;

      if (!rendererState.ordering[orderingKey]) {

        rendererState.ordering[orderingKey] =
          Array.isArray(element.items)
            ? [...element.items].sort(
                () => Math.random() - 0.5
              )
            : [];
      }

      const items =
        rendererState.ordering[orderingKey];

      return `
        <div
          class="mission-exercise"
          data-type="ordering"
          data-element-index="${elementIndex}">

          <strong>
            ${escapeHtml(element.question || "")}
          </strong>

          <div class="ordering-list">

            ${items.map((item, itemIndex) => `

              <div
                class="ordering-item"
                data-ordering-id="${escapeHtml(item.id)}">

                <span class="ordering-number">
                  ${itemIndex + 1}.
                </span>

                <span>
                  ${escapeHtml(item.text || "")}
                </span>

              </div>

            `).join("")}

          </div>

          <button
            type="button"
            class="mission-check-btn"
            data-action="check-ordering">

            Check order

          </button>

          <div class="mission-feedback"></div>

        </div>
      `;
    }


    /*
     * ----------------------------------------------------------
     * MATCHING
     * ----------------------------------------------------------
     */

    if (element.type === "matching") {

      const pairs =
        Array.isArray(element.pairs)
          ? [...element.pairs]
              .sort(() => Math.random() - 0.5)
          : [];

      const shuffledRights =
        Array.isArray(element.pairs)
          ? [...element.pairs]
              .sort(() => Math.random() - 0.5)
          : [];

      return `
        <div
          class="mission-exercise"
          data-type="matching"
          data-element-index="${elementIndex}">

          <strong>
            ${escapeHtml(element.question || "")}
          </strong>

          <div class="matching-list">

            ${pairs.map(pair => `

              <div class="matching-row">

                <div class="matching-left">
                  ${escapeHtml(pair.left || "")}
                </div>

                <select
                  class="matching-select"
                  data-pair-id="${escapeHtml(pair.id)}">

                  <option value="">
                    Choose...
                  </option>

                  ${shuffledRights.map(right => `

                    <option
                      value="${escapeHtml(right.id)}">

                      ${escapeHtml(right.right || "")}

                    </option>

                  `).join("")}

                </select>

              </div>

            `).join("")}

          </div>

          <button
            type="button"
            class="mission-check-btn"
            data-action="check-matching">

            Check answers

          </button>

          <div class="mission-feedback"></div>

        </div>
      `;
    }


    /*
     * ----------------------------------------------------------
     * CATEGORISE
     * ----------------------------------------------------------
     */

    if (element.type === "categorise") {

      const categories =
        Array.isArray(element.categories)
          ? element.categories
          : [];

      return `
        <div
          class="mission-exercise"
          data-type="categorise"
          data-element-index="${elementIndex}">

          <strong>
            ${escapeHtml(element.question || "")}
          </strong>

          <div class="categorise-list">

            ${(element.items || []).map(item => `

              <div class="categorise-row">

                <div class="categorise-item">
                  ${escapeHtml(item.text || "")}
                </div>

                <select
                  class="categorise-select"
                  data-item-id="${escapeHtml(item.id)}">

                  <option value="">
                    Choose...
                  </option>

                  ${categories.map(category => `

                    <option
                      value="${escapeHtml(category.id)}">

                      ${escapeHtml(category.name || "")}

                    </option>

                  `).join("")}

                </select>

              </div>

            `).join("")}

          </div>

          <button
            type="button"
            class="mission-check-btn"
            data-action="check-categorise">

            Check answers

          </button>

          <div class="mission-feedback"></div>

        </div>
      `;
    }


    /*
     * ----------------------------------------------------------
     * SELECT FROM TEXT
     * ----------------------------------------------------------
     */

    if (element.type === "select_from_text") {

      return `
        <div
          class="mission-exercise"
          data-type="select_from_text"
          data-element-index="${elementIndex}">

          <strong>
            ${escapeHtml(element.question || "")}
          </strong>

          ${
            element.text
              ? `
                <div class="select-text-content">
                  ${escapeHtml(element.text)}
                </div>
              `
              : ""
          }

          <div class="mission-options">

            ${(element.options || []).map(option => `

              <label class="mission-option">

                <input
                  type="checkbox"
                  value="${escapeHtml(option.id)}">

                <span>
                  ${escapeHtml(option.text || "")}
                </span>

              </label>

            `).join("")}

          </div>

          <button
            type="button"
            class="mission-check-btn"
            data-action="check-select-from-text">

            Check selection

          </button>

          <div class="mission-feedback"></div>

        </div>
      `;
    }


    /*
     * ----------------------------------------------------------
     * FILL IN THE BLANK
     * ----------------------------------------------------------
     */

    if (element.type === "fill_blank") {

      let html =
        escapeHtml(element.text || "");

      html =
        html.replace(
          /\{\{(\d+)\}\}/g,
          (match, number) => {

            const blank =
              (element.blanks || [])
                [Number(number) - 1];

            if (!blank) {
              return match;
            }

            return `
              <input
                type="text"
                class="fill-blank-input"
                data-blank-id="${escapeHtml(blank.id)}">
            `;
          }
        );

      return `
        <div
          class="mission-exercise"
          data-type="fill_blank"
          data-element-index="${elementIndex}">

          <strong>
            ${escapeHtml(element.question || "")}
          </strong>

          <div class="fill-blank-content">
            ${html}
          </div>

          <button
            type="button"
            class="mission-check-btn"
            data-action="check-fill-blank">

            Check answers

          </button>

          <div class="mission-feedback"></div>

        </div>
      `;
    }


    /*
     * ----------------------------------------------------------
     * BUILD SENTENCE
     * ----------------------------------------------------------
     */

    if (element.type === "build_sentence") {

      const key =
        `build_${cardKey}_${elementIndex}`;

      if (!rendererState.buildSentence[key]) {

        rendererState.buildSentence[key] =
          [...(element.tokens || [])]
            .sort(() => Math.random() - 0.5);
      }

      const tokens =
        rendererState.buildSentence[key];

      return `
        <div
          class="mission-exercise"
          data-type="build_sentence"
          data-element-index="${elementIndex}">

          <strong>
            ${escapeHtml(element.question || "")}
          </strong>

          <div class="build-sentence-list">

            ${tokens.map(token => `

              <button
                type="button"
                class="build-token"
                data-token-id="${escapeHtml(token.id)}">

                ${escapeHtml(token.text || "")}

              </button>

            `).join("")}

          </div>

          <div class="build-answer"></div>

          <button
            type="button"
            class="mission-check-btn"
            data-action="check-build-sentence">

            Check sentence

          </button>

          <div class="mission-feedback"></div>

        </div>
      `;
    }


    /*
     * ----------------------------------------------------------
     * OPEN RESPONSE
     * ----------------------------------------------------------
     */

    if (element.type === "open_response") {

      return `
        <div
          class="mission-exercise"
          data-type="open_response"
          data-element-index="${elementIndex}">

          <strong>
            ${escapeHtml(element.question || "")}
          </strong>

          <textarea
            class="open-response-input"
            placeholder="Write your answer here...">
          </textarea>

          <button
            type="button"
            class="mission-check-btn"
            data-action="check-open-response">

            Compare with an example

          </button>

          <div class="mission-feedback"></div>

        </div>
      `;
    }


    return "";
  }


  /*
   * ------------------------------------------------------------
   * Rendu d'une carte complète
   * ------------------------------------------------------------
   */

  function renderCard(card, options = {}) {

    if (!card) {
      return "";
    }

    const elements =
      Array.isArray(card.elements)
        ? card.elements
        : [];

    const cardKey =
      options.cardKey !== undefined
        ? options.cardKey
        : card.order || "card";

    return `
      <div
        class="mission-card-rendered"
        data-card-order="${escapeHtml(card.order || "")}">

        <div class="mission-card-title">
          ${escapeHtml(card.title || "")}
        </div>

        ${
          card.instruction
            ? `
              <div
  class="mission-card-instruction"
  style="white-space: pre-line;">
  ${escapeHtml(card.instruction)}
</div>
            `
            : ""
        }

        <div class="mission-card-elements">

          ${elements.map((element, index) => `

            <div
              class="preview-element"
              data-element-index="${index}">

              ${renderElement(element, {
                cardKey,
                elementIndex: index
              })}

            </div>

          `).join("")}

        </div>

      </div>
    `;
  }


  /*
   * ------------------------------------------------------------
   * Vérification True / False
   * ------------------------------------------------------------
   */

function getExerciseAnswer(exercise, element, container) {
  if (!exercise || !element || !container) {
    return null;
  }

  const type = element.type;

  if (type === "multiple_choice") {
    return Array.from(
      container.querySelectorAll(
        '.mission-exercise[data-type="multiple_choice"] input:checked'
      )
    ).map(input => input.value);
  }

  if (type === "true_false") {
    const selected = container.querySelector(
      '.mission-exercise[data-type="true_false"] input:checked'
    );

    return selected ? selected.value : null;
  }

  if (type === "ordering") {
    return Array.from(
      container.querySelectorAll(
        '.mission-exercise[data-type="ordering"] .ordering-item'
      )
    ).map(item =>
      item.dataset.value ||
      item.dataset.id ||
      item.textContent.trim()
    );
  }

  if (type === "matching") {
    return Array.from(
      container.querySelectorAll(
        '.mission-exercise[data-type="matching"] .matching-row'
      )
    ).map(row => {
      const left = row.querySelector('.matching-left');
      const select = row.querySelector('.matching-select');

      return {
        left: left ? left.textContent.trim() : null,
        right: select ? select.value : null
      };
    });
  }

  if (type === "categorise") {
    return Array.from(
      container.querySelectorAll(
        '.mission-exercise[data-type="categorise"] .categorise-row'
      )
    ).map(row => {
      const item = row.querySelector('.categorise-item');
      const select = row.querySelector('.categorise-select');

      return {
        item: item ? item.textContent.trim() : null,
        category: select ? select.value : null
      };
    });
  }

  if (type === "select_from_text") {
    return Array.from(
      container.querySelectorAll(
        '.mission-exercise[data-type="select_from_text"] input:checked'
      )
    ).map(input => input.value);
  }

  if (type === "fill_blank") {
    return Array.from(
      container.querySelectorAll(
        '.mission-exercise[data-type="fill_blank"] .fill-blank-input'
      )
    ).map(input => input.value);
  }

 if (type === "build_sentence") {
  return Array.from(
    exercise.querySelectorAll(
      '.build-answer .build-token'
    )
  ).map(
    token => token.dataset.tokenId
  );
}

  if (type === "open_response") {
    const input = container.querySelector(
      '.mission-exercise[data-type="open_response"] .open-response-input'
    );

    return input ? input.value : null;
  }

  return null;
}

  function checkTrueFalse(exercise, element) {

    const selected =
      exercise.querySelector(
        'input[type="radio"]:checked'
      );

    const feedback =
      exercise.querySelector(".mission-feedback");

    if (!feedback) {
      return false;
    }

    if (!selected) {

      feedback.textContent =
        "Please select an answer.";

      feedback.className =
        "mission-feedback incorrect";

      return false;
    }

    const userAnswer =
      selected.value === "true";

    const isCorrect =
      userAnswer === Boolean(element.correct);

    if (isCorrect) {

      feedback.textContent =
        element.feedback_correct ||
        "Correct!";

      feedback.className =
        "mission-feedback correct";

    } else {

      feedback.textContent =
        element.feedback_incorrect ||
        "Not quite. Try again.";

      feedback.className =
        "mission-feedback incorrect";
    }

    return isCorrect;
  }


  /*
   * ------------------------------------------------------------
   * Vérification Multiple Choice
   * ------------------------------------------------------------
   */

  function checkMultipleChoice(exercise, element) {

    const selected =
      Array.from(
        exercise.querySelectorAll(
          'input[type="checkbox"]:checked'
        )
      ).map(
        input => input.value
      );

    const feedback =
      exercise.querySelector(".mission-feedback");

    if (!feedback) {
      return false;
    }

    if (!selected.length) {

      feedback.textContent =
        "Please select at least one answer.";

      feedback.className =
        "mission-feedback incorrect";

      return false;
    }

    const correctAnswers =
      Array.isArray(element.correct)
        ? [...element.correct].sort()
        : [];

    const userAnswers =
      [...selected].sort();

    const isCorrect =
      correctAnswers.length === userAnswers.length &&
      correctAnswers.every(
        (id, index) =>
          id === userAnswers[index]
      );

    if (isCorrect) {

      feedback.textContent =
        element.feedback_correct ||
        "Correct!";

      feedback.className =
        "mission-feedback correct";

    } else {

      feedback.textContent =
        element.feedback_incorrect ||
        "Not quite. Try again.";

      feedback.className =
        "mission-feedback incorrect";
    }

    return isCorrect;
  }


  /*
   * ------------------------------------------------------------
   * Vérification Ordering
   * ------------------------------------------------------------
   */

  function checkOrdering(exercise, element) {

    const items =
      exercise.querySelectorAll(
        ".ordering-item"
      );

    const userOrder =
      Array.from(items).map(
        item =>
          item.dataset.orderingId
      );

    const correctOrder =
      Array.isArray(element.correct_order)
        ? element.correct_order
        : [];

    const isCorrect =
      userOrder.length === correctOrder.length &&
      userOrder.every(
        (id, index) =>
          id === correctOrder[index]
      );

    const feedback =
      exercise.querySelector(".mission-feedback");

    if (!feedback) {
      return false;
    }

    feedback.textContent =
      isCorrect
        ? (
            element.feedback_correct ||
            "Correct!"
          )
        : (
            element.feedback_incorrect ||
            "Not quite. Try again."
          );

    feedback.className =
      isCorrect
        ? "mission-feedback correct"
        : "mission-feedback incorrect";

    return isCorrect;
  }


  /*
   * ------------------------------------------------------------
   * Vérification Matching
   * ------------------------------------------------------------
   */

  function checkMatching(exercise, element) {

    const selects =
      exercise.querySelectorAll(
        ".matching-select"
      );

    const correct =
      selects.length ===
        (element.pairs || []).length &&
      Array.from(selects).every(select => {

        const pair =
          (element.pairs || []).find(
            pair =>
              pair.id === select.dataset.pairId
          );

        return pair &&
          select.value === pair.id;

      });

    const feedback =
      exercise.querySelector(".mission-feedback");

    if (!feedback) {
      return false;
    }

    feedback.textContent =
      correct
        ? (
            element.feedback_correct ||
            "Correct!"
          )
        : (
            element.feedback_incorrect ||
            "Not quite. Try again."
          );

    feedback.className =
      correct
        ? "mission-feedback correct"
        : "mission-feedback incorrect";

    return correct;
  }


  /*
   * ------------------------------------------------------------
   * Vérification Categorise
   * ------------------------------------------------------------
   */

  function checkCategorise(exercise, element) {

    const selects =
      exercise.querySelectorAll(
        ".categorise-select"
      );

    const correct =
      selects.length ===
        (element.items || []).length &&
      Array.from(selects).every(select => {

        const item =
          (element.items || []).find(
            item =>
              item.id === select.dataset.itemId
          );

        return item &&
          select.value === item.categoryId;

      });

    const feedback =
      exercise.querySelector(".mission-feedback");

    if (!feedback) {
      return false;
    }

    feedback.textContent =
      correct
        ? (
            element.feedback_correct ||
            "Correct!"
          )
        : (
            element.feedback_incorrect ||
            "Not quite. Try again."
          );

    feedback.className =
      correct
        ? "mission-feedback correct"
        : "mission-feedback incorrect";

    return correct;
  }


  /*
   * ------------------------------------------------------------
   * Vérification Select From Text
   * ------------------------------------------------------------
   */

  function checkSelectFromText(exercise, element) {

    const selected =
      Array.from(
        exercise.querySelectorAll(
          'input[type="checkbox"]:checked'
        )
      )
      .map(
        input => input.value
      )
      .sort();

    const correct =
      Array.isArray(element.correct)
        ? [...element.correct].sort()
        : [];

    const isCorrect =
      selected.length === correct.length &&
      selected.every(
        (id, index) =>
          id === correct[index]
      );

    const feedback =
      exercise.querySelector(".mission-feedback");

    if (!feedback) {
      return false;
    }

    feedback.textContent =
      isCorrect
        ? (
            element.feedback_correct ||
            "Correct!"
          )
        : (
            element.feedback_incorrect ||
            "Not quite. Try again."
          );

    feedback.className =
      isCorrect
        ? "mission-feedback correct"
        : "mission-feedback incorrect";

    return isCorrect;
  }


  /*
   * ------------------------------------------------------------
   * Vérification Fill Blank
   * ------------------------------------------------------------
   */

  function checkFillBlank(exercise, element) {

    const inputs =
      exercise.querySelectorAll(
        ".fill-blank-input"
      );

    let allCorrect = true;

    inputs.forEach(input => {

      const blank =
        (element.blanks || []).find(
          blank =>
            blank.id === input.dataset.blankId
        );

      if (!blank) {
        return;
      }

      const userAnswer =
        input.value
          .trim()
          .toLowerCase();

      const accepted = [
        blank.answer,
        ...(blank.alternatives || "")
          .split(",")
          .map(
            answer =>
              answer.trim()
          )
          .filter(Boolean)
      ]
        .map(
          answer =>
            answer.toLowerCase()
        );

      if (!accepted.includes(userAnswer)) {
        allCorrect = false;
      }

    });

    const feedback =
      exercise.querySelector(".mission-feedback");

    if (!feedback) {
      return false;
    }

    feedback.textContent =
      allCorrect
        ? (
            element.feedback_correct ||
            "Correct!"
          )
        : (
            element.feedback_incorrect ||
            "Not quite. Try again."
          );

    feedback.className =
      allCorrect
        ? "mission-feedback correct"
        : "mission-feedback incorrect";

    return allCorrect;
  }


  /*
   * ------------------------------------------------------------
   * Vérification Build Sentence
   * ------------------------------------------------------------
   */

  function checkBuildSentence(exercise, element) {

    const tokens =
      Array.from(
        exercise.querySelectorAll(
          ".build-answer .build-token"
        )
      )
      .map(
        token =>
          token.dataset.tokenId
      );

    const correctOrder =
      Array.isArray(element.correct_order)
        ? element.correct_order
        : [];

  const isCorrect =
  correctOrder.length > 0 &&
  tokens.length === correctOrder.length &&
  tokens.every(
    (id, index) =>
      id === correctOrder[index]
  );

    const feedback =
      exercise.querySelector(".mission-feedback");

    if (!feedback) {
      return false;
    }

    feedback.textContent =
      isCorrect
        ? (
            element.feedback_correct ||
            "Correct!"
          )
        : (
            element.feedback_incorrect ||
            "Not quite. Try again."
          );

    feedback.className =
      isCorrect
        ? "mission-feedback correct"
        : "mission-feedback incorrect";

    return isCorrect;
  }


  /*
   * ------------------------------------------------------------
   * Vérification Open Response
   * ------------------------------------------------------------
   */

  function checkOpenResponse(exercise, element) {

    const input =
      exercise.querySelector(
        ".open-response-input"
      );

    const feedback =
      exercise.querySelector(
        ".mission-feedback"
      );

    if (!input || !feedback) {
      return false;
    }

    if (!input.value.trim()) {

      feedback.textContent =
        "Write your own answer first. Then compare it with the example.";

      feedback.className =
        "mission-feedback incorrect";

      return false;
    }

    feedback.innerHTML = `
      <div class="open-response-feedback-text">

        ${escapeHtml(
          element.feedback_correct ||
          "Compare your answer with the example."
        )}

      </div>

      <div class="open-response-example">

        <strong>
          Possible answer:
        </strong>

        <br>

        ${escapeHtml(
          element.model_answer || ""
        )}

      </div>
    `;

    feedback.className =
      "mission-feedback neutral";

    return true;
  }


  /*
   * ------------------------------------------------------------
   * Initialisation des interactions
   * ------------------------------------------------------------
   */

  function bindInteractions(container, card, options = {}) {

  if (!container || !card) {
    return;
  }

  const onResult =
    typeof options.onResult === "function"
      ? options.onResult
      : null;


  /*
   * ----------------------------------------------------------
   * ORDERING — drag & drop
   * ----------------------------------------------------------
   */

  container
    .querySelectorAll(".ordering-list")
    .forEach(list => {

      let draggedItem = null;

      list
        .querySelectorAll(".ordering-item")
        .forEach(item => {

          item.draggable = true;

          item.addEventListener(
            "dragstart",
            () => {

              draggedItem = item;

              item.classList.add(
                "dragging"
              );

            }
          );

          item.addEventListener(
            "dragend",
            () => {

              item.classList.remove(
                "dragging"
              );

              draggedItem = null;

            }
          );

          item.addEventListener(
            "dragover",
            event => {

              event.preventDefault();

              if (
                !draggedItem ||
                draggedItem === item
              ) {
                return;
              }

              const rect =
                item.getBoundingClientRect();

              const middle =
                rect.top +
                rect.height / 2;

              if (
                event.clientY < middle
              ) {

                list.insertBefore(
                  draggedItem,
                  item
                );

              } else {

                list.insertBefore(
                  draggedItem,
                  item.nextSibling
                );

              }

            }
          );

        });

    });


  /*
   * ----------------------------------------------------------
   * BUILD SENTENCE
   * ----------------------------------------------------------
   */

  container
    .querySelectorAll(".build-sentence-list")
    .forEach(list => {

      const exercise =
        list.closest(
          ".mission-exercise"
        );

      if (!exercise) {
        return;
      }

      const answerBox =
        exercise.querySelector(
          ".build-answer"
        );

      if (!answerBox) {
        return;
      }

      list
        .querySelectorAll(".build-token")
        .forEach(token => {

          token.addEventListener(
            "click",
            () => {

              const existingToken =
                answerBox.querySelector(
                  `.build-token[data-token-id="${token.dataset.tokenId}"]`
                );

              if (existingToken) {
                return;
              }

              const clone =
                token.cloneNode(true);

              clone.addEventListener(
                "click",
                () => {

                  clone.remove();

                  token.classList.remove(
                    "selected"
                  );

                }
              );

              answerBox.appendChild(
                clone
              );

              token.classList.add(
                "selected"
              );

            }
          );

        });

    });


  /*
   * ----------------------------------------------------------
   * CHECK BUTTONS
   * ----------------------------------------------------------
   */

  container
    .querySelectorAll(
      ".mission-check-btn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const exercise =
            button.closest(
              ".mission-exercise"
            );

          if (!exercise) {
            return;
          }

if (exercise.dataset.checked === "true") {
  return;
}
            
          const elementIndex =
            Number(
              exercise.dataset.elementIndex
            );

          const element =
            card.elements[elementIndex];

          if (!element) {
            return;
          }

          const action =
            button.dataset.action;

        console.log(
  "CHECK CLIQUÉ",
  action
);

          let isCorrect = false;

          if (
            action ===
            "check-true-false"
          ) {

            isCorrect =
              checkTrueFalse(
                exercise,
                element
              );

          } else if (
            action ===
            "check-multiple-choice"
          ) {

            isCorrect =
              checkMultipleChoice(
                exercise,
                element
              );

          } else if (
            action ===
            "check-ordering"
          ) {

            isCorrect =
              checkOrdering(
                exercise,
                element
              );

          } else if (
            action ===
            "check-matching"
          ) {

            isCorrect =
              checkMatching(
                exercise,
                element
              );

          } else if (
            action ===
            "check-categorise"
          ) {

            isCorrect =
              checkCategorise(
                exercise,
                element
              );

          } else if (
            action ===
            "check-select-from-text"
          ) {

            isCorrect =
              checkSelectFromText(
                exercise,
                element
              );

          } else if (
            action ===
            "check-fill-blank"
          ) {

            isCorrect =
              checkFillBlank(
                exercise,
                element
              );

          } else if (
            action ===
            "check-build-sentence"
          ) {

            isCorrect =
              checkBuildSentence(
                exercise,
                element
              );

          } else if (
            action ===
            "check-open-response"
          ) {

            isCorrect =
              checkOpenResponse(
                exercise,
                element
              );

          } else {
            return;
          }


          /*
           * ----------------------------------------------------
           * Transmission du résultat
           * ----------------------------------------------------
           */
exercise.dataset.checked = "true";
button.disabled = true;
button.textContent = "Réponse contrôlée ✓";
            
          if (onResult) {
  onResult({
    elementIndex,
    exerciseType: element.type,
    isCorrect,
    exercise,
    element,
    answer: getExerciseAnswer(exercise, element, container)
  });
}

        }
      );

    });

}


  /*
   * ------------------------------------------------------------
   * Réinitialisation
   * ------------------------------------------------------------
   */

  function reset() {
  rendererState.ordering = {};
  rendererState.buildSentence = {};
}


  /*
   * ------------------------------------------------------------
   * API publique
   * ------------------------------------------------------------
   */

  window.ParlaMissionRenderer = {

    escapeHtml,

    convertYoutubeUrl,

    renderElement,

    renderCard,

    bindInteractions,

    reset

  };


})();
