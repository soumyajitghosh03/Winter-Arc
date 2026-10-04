/* =========================================================
   WINTER ARC 2026 · script2.js
   Extra trackers: workout, meditation, reading, water, food.

   Load AFTER script.js. It reuses script.js's API client,
   toasts, date helpers and the currently selected day, and
   reloads whenever the selected day changes.
   No browser storage; the backend is the source of truth.
   ========================================================= */

(function () {

    if (typeof createResource !== "function") {

        console.error(
            "script2.js needs script.js to be loaded first."
        );

        return;

    }


    /* -----------------------------------------------------
       CONFIGURATION
       ----------------------------------------------------- */

    /* API paths (relative to API_BASE_URL in script.js) */
    const ENDPOINTS = {
        workout: "/workout-records",
        meditation: "/meditation-records",
        reading: "/reading-records",
        water: "/water-records",
        food: "/food-records"
    };

    const WATER_GLASS_ML = 250;
    const WATER_TARGET_GLASSES = 8;

    const resources = {};

    Object.entries(ENDPOINTS).forEach(
        ([name, path]) => {
            resources[name] = createResource(path);
        }
    );


    /* -----------------------------------------------------
       SMALL HELPERS
       ----------------------------------------------------- */

    const $ = id => document.getElementById(id);

    let extrasLoadId = 0;


    function minutesBetween(start, end) {

        if (!start || !end) {
            return 0;
        }

        const [startHour, startMinute] =
            start.split(":").map(Number);

        const [endHour, endMinute] =
            end.split(":").map(Number);

        const startMinutes =
            startHour * 60 + startMinute;

        let endMinutes =
            endHour * 60 + endMinute;

        /* crossed midnight */
        if (endMinutes < startMinutes) {
            endMinutes += 24 * 60;
        }

        return endMinutes - startMinutes;

    }


    function formatClock(time) {

        if (!time) {
            return "";
        }

        const [hour, minute] =
            time.split(":").map(Number);

        const suffix =
            hour >= 12 ? "PM" : "AM";

        const display =
            hour % 12 === 0 ? 12 : hour % 12;

        return `${display}:${String(minute).padStart(2, "0")} ${suffix}`;

    }


    function formatWater(ml) {

        if (ml < 1000) {
            return `${ml} ml`;
        }

        return `${+(ml / 1000).toFixed(2)} L`;

    }


    function flash(element, text, restore, delay = 1200) {

        element.textContent = text;

        setTimeout(
            () => {
                element.textContent = restore();
            },
            delay
        );

    }


    /* A 404 simply means "nothing saved for this day" */

    function readResult(result, failures) {

        if (result.status === "fulfilled") {
            return { ok: true, value: result.value };
        }

        if (result.reason && result.reason.status === 404) {
            return { ok: true, value: null };
        }

        failures.push(result.reason);

        return { ok: false, value: null };

    }


    /* -----------------------------------------------------
       TIMED CARDS: workout, meditation, reading
       Same shape: start, end, duration. Reading adds a
       book title and pages.
       ----------------------------------------------------- */

    const timedCards = [

        {
            key: "workout",
            label: "workout",
            resource: resources.workout,
            startEl: $("workoutStart"),
            endEl: $("workoutEnd"),
            durationEl: $("workoutDuration"),
            saveButton: $("saveWorkout"),
            saveLabel: "Save workout",
            requireTimes: true
        },

        {
            key: "meditation",
            label: "meditation",
            resource: resources.meditation,
            startEl: $("meditationStart"),
            endEl: $("meditationEnd"),
            durationEl: $("meditationDuration"),
            saveButton: $("saveMeditation"),
            saveLabel: "Save meditation",
            requireTimes: true
        },

        {
            key: "reading",
            label: "reading",
            resource: resources.reading,
            startEl: $("readingStart"),
            endEl: $("readingEnd"),
            durationEl: $("readingDuration"),
            saveButton: $("saveReading"),
            saveLabel: "Save reading",
            requireTimes: false,

            bookEl: $("readingBook"),
            pagesEl: $("readingPages"),

            mapExtra: raw => ({
                book:
                    raw.bookTitle ??
                    raw.book ??
                    raw.title ??
                    "",

                pages:
                    raw.pagesRead ??
                    raw.pages ??
                    ""
            }),

            readExtra() {

                return {
                    book: this.bookEl.value.trim(),

                    pages:
                        this.pagesEl.value === ""
                            ? ""
                            : Number(this.pagesEl.value)
                };

            },

            applyExtra(record) {

                this.bookEl.value =
                    record ? record.book : "";

                this.pagesEl.value =
                    record && record.pages !== ""
                        ? record.pages
                        : "";

            },

            toApiExtra: values => ({
                bookTitle: values.book,
                pagesRead:
                    values.pages === ""
                        ? null
                        : values.pages
            })
        }

    ];


    /* in-memory state per card */

    timedCards.forEach(
        card => {

            card.record = null;

            card.loaded = false;

        }
    );


    function mapTimed(raw, card) {

        return {

            id: idOf(raw),

            start:
                toTimeInput(
                    raw.startTime ??
                    raw.start ??
                    raw.start_time
                ),

            end:
                toTimeInput(
                    raw.endTime ??
                    raw.end ??
                    raw.end_time
                ),

            duration:
                Number(
                    raw.duration ??
                    raw.durationMinutes ??
                    0
                ) || 0,

            ...(card.mapExtra ? card.mapExtra(raw) : {})

        };

    }


    function toApiTimed(values, card, date) {

        return {

            date,

            startTime: values.start || null,

            endTime: values.end || null,

            duration: values.duration,

            ...(card.toApiExtra ? card.toApiExtra(values) : {})

        };

    }


    function updateTimedDuration(card) {

        const minutes =
            minutesBetween(
                card.startEl.value,
                card.endEl.value
            );

        card.durationEl.textContent =
            minutes ? formatDuration(minutes) : "—";

        return minutes;

    }


    function applyTimed(card) {

        card.startEl.value =
            card.record ? card.record.start : "";

        card.endEl.value =
            card.record ? card.record.end : "";

        if (card.applyExtra) {
            card.applyExtra(card.record);
        }

        updateTimedDuration(card);

    }


    timedCards.forEach(
        card => {

            card.startEl.addEventListener(
                "change",
                () => updateTimedDuration(card)
            );

            card.endEl.addEventListener(
                "change",
                () => updateTimedDuration(card)
            );

            card.saveButton.addEventListener(
                "click",
                () => saveTimed(card)
            );

        }
    );


    async function saveTimed(card) {

        if (!card.loaded) {

            showToast(
                `Your ${card.label} didn't load for this day. Reload it before saving.`,
                {
                    actionLabel: "Reload",
                    onAction: loadExtras
                }
            );

            return;

        }

        const values = {
            start: card.startEl.value,
            end: card.endEl.value,
            ...(card.readExtra ? card.readExtra() : {})
        };

        if (card.requireTimes) {

            if (!values.start || !values.end) {

                showToast(
                    `Set both a start and end time for your ${card.label}.`,
                    { type: "info" }
                );

                return;

            }

        } else {

            const hasTimes = values.start && values.end;

            const hasExtra =
                Boolean(values.book) || values.pages !== "";

            if (!hasTimes && !hasExtra) {

                showToast(
                    "Add a book, pages read, or a start and end time.",
                    { type: "info" }
                );

                return;

            }

        }

        values.duration =
            updateTimedDuration(card);

        const key = dateKey(selectedDate);

        const saved = await withButton(
            card.saveButton,
            "Saving...",
            async () => {

                try {

                    const payload =
                        toApiTimed(values, card, key);

                    const existing = card.record;

                    let id;

                    if (existing && existing.id !== null) {

                        await card.resource.update(
                            existing.id,
                            payload
                        );

                        id = existing.id;

                    } else {

                        const created =
                            await card.resource.create(payload);

                        id =
                            idOf(created) ??
                            idOf(
                                firstOf(
                                    await card.resource.list({ date: key })
                                )
                            );

                    }

                    if (dateKey(selectedDate) === key) {

                        card.record = { id, ...values };

                    }

                    return true;

                } catch (error) {

                    reportError(
                        error,
                        `Could not save your ${card.label}.`
                    );

                    return false;

                }

            }
        );

        if (saved && dateKey(selectedDate) === key) {

            flash(
                card.saveButton,
                "Saved ✓",
                () => card.saveLabel
            );

        }

    }


    /* -----------------------------------------------------
       WATER
       ----------------------------------------------------- */

    const water = {

        record: null,

        loaded: false,

        glasses: 0,

        dropsEl: $("waterDrops"),
        glassesEl: $("waterGlasses"),
        targetEl: $("waterTarget"),
        mlEl: $("waterMl"),
        barEl: $("waterBar"),
        statusEl: $("waterStatus"),

        minusButton: $("waterMinus"),
        plusButton: $("waterPlus"),
        saveButton: $("saveWater")

    };


    function mapWater(raw) {

        const ml =
            Number(
                raw.amountMl ??
                raw.amount ??
                raw.ml ??
                (raw.glasses ? raw.glasses * WATER_GLASS_ML : 0)
            ) || 0;

        return {
            id: idOf(raw),
            amountMl: ml
        };

    }


    function waterStatusText() {

        return water.record ? "Saved" : "Not logged";

    }


    function renderWater() {

        const { glasses } = water;

        water.targetEl.textContent =
            WATER_TARGET_GLASSES;

        water.glassesEl.textContent =
            glasses;

        water.mlEl.textContent =
            formatWater(glasses * WATER_GLASS_ML);

        water.barEl.style.width =
            `${Math.min(100, (glasses / WATER_TARGET_GLASSES) * 100)}%`;

        water.minusButton.disabled =
            glasses === 0;

        /* always show the target, more if exceeded */

        const total =
            Math.max(WATER_TARGET_GLASSES, glasses);

        water.dropsEl.innerHTML = "";

        for (let index = 1; index <= total; index++) {

            const drop =
                document.createElement("button");

            drop.type = "button";

            drop.className =
                "water-drop" +
                (index <= glasses ? " filled" : "");

            drop.textContent = "💧";

            drop.setAttribute(
                "aria-label",
                `${index} ${index === 1 ? "glass" : "glasses"}`
            );

            drop.addEventListener(
                "click",
                () => {

                    /* tapping the last filled drop undoes it */

                    setGlasses(
                        glasses === index ? index - 1 : index
                    );

                }
            );

            water.dropsEl.appendChild(drop);

        }

    }


    function setGlasses(count) {

        water.glasses = Math.max(0, count);

        water.statusEl.textContent =
            "Unsaved changes";

        renderWater();

    }


    water.minusButton.addEventListener(
        "click",
        () => setGlasses(water.glasses - 1)
    );


    water.plusButton.addEventListener(
        "click",
        () => setGlasses(water.glasses + 1)
    );


    water.saveButton.addEventListener(
        "click",
        async () => {

            if (!water.loaded) {

                showToast(
                    "Water intake didn't load for this day. Reload it before saving.",
                    {
                        actionLabel: "Reload",
                        onAction: loadExtras
                    }
                );

                return;

            }

            if (!water.record && water.glasses === 0) {

                showToast(
                    "Add a glass of water first.",
                    { type: "info" }
                );

                return;

            }

            const key = dateKey(selectedDate);

            const glasses = water.glasses;

            const saved = await withButton(
                water.saveButton,
                "Saving...",
                async () => {

                    try {

                        const payload = {
                            date: key,
                            amountMl: glasses * WATER_GLASS_ML
                        };

                        const existing = water.record;

                        let id;

                        if (existing && existing.id !== null) {

                            await resources.water.update(
                                existing.id,
                                payload
                            );

                            id = existing.id;

                        } else {

                            const created =
                                await resources.water.create(payload);

                            id =
                                idOf(created) ??
                                idOf(
                                    firstOf(
                                        await resources.water.list({ date: key })
                                    )
                                );

                        }

                        if (dateKey(selectedDate) === key) {

                            water.record = {
                                id,
                                amountMl: payload.amountMl
                            };

                        }

                        return true;

                    } catch (error) {

                        reportError(
                            error,
                            "Could not save water intake."
                        );

                        return false;

                    }

                }
            );

            if (saved && dateKey(selectedDate) === key) {

                flash(
                    water.statusEl,
                    "Saved ✓",
                    waterStatusText
                );

                flash(
                    water.saveButton,
                    "Saved ✓",
                    () => "Save water"
                );

            }

        }
    );


    /* -----------------------------------------------------
       FOOD INTAKE
       ----------------------------------------------------- */

    const food = {

        records: {},      // mealType -> record

        loaded: false

    };


    const mealCards =
        Array.from(
            document.querySelectorAll("[data-meal]")
        ).map(
            element => ({
                meal: element.dataset.meal,
                element,
                timeEl: element.querySelector(".meal-time"),
                foodEl: element.querySelector(".meal-food"),
                statusEl: element.querySelector(".meal-status"),
                saveButton: element.querySelector(".meal-save")
            })
        );


    function mapFood(raw) {

        return {

            id: idOf(raw),

            meal:
                String(
                    raw.mealType ??
                    raw.meal_type ??
                    raw.type ??
                    raw.category ??
                    ""
                ).toLowerCase(),

            time:
                toTimeInput(
                    raw.time ??
                    raw.mealTime ??
                    raw.eatenAt
                ),

            description:
                raw.description ??
                raw.food ??
                raw.items ??
                raw.notes ??
                ""

        };

    }


    function toApiFood({ date, meal, time, description }) {

        return {
            date,
            mealType: meal,
            time: time || null,
            description
        };

    }


    function mealStatusText(card) {

        const record = food.records[card.meal];

        if (!record) {
            return "Not logged";
        }

        return record.time
            ? `Logged · ${formatClock(record.time)}`
            : "Logged";

    }


    function renderMeal(card) {

        const record = food.records[card.meal];

        card.timeEl.value =
            record ? record.time : "";

        card.foodEl.value =
            record ? record.description : "";

        card.statusEl.textContent =
            mealStatusText(card);

        card.statusEl.classList.toggle(
            "logged",
            Boolean(record)
        );

    }


    mealCards.forEach(
        card => {

            card.saveButton.addEventListener(
                "click",
                () => saveMeal(card)
            );

        }
    );


    async function saveMeal(card) {

        if (!food.loaded) {

            showToast(
                "Food intake didn't load for this day. Reload it before saving.",
                {
                    actionLabel: "Reload",
                    onAction: loadExtras
                }
            );

            return;

        }

        const key = dateKey(selectedDate);

        const time = card.timeEl.value;

        const description = card.foodEl.value.trim();

        const existing = food.records[card.meal];

        if (!existing && !time && !description) {

            showToast(
                "Add the time or what you ate first.",
                { type: "info" }
            );

            return;

        }

        const saved = await withButton(
            card.saveButton,
            "Saving...",
            async () => {

                try {

                    /* clearing a logged meal removes it */

                    if (existing && !time && !description) {

                        await resources.food.remove(existing.id);

                        if (dateKey(selectedDate) === key) {
                            delete food.records[card.meal];
                        }

                        return "removed";

                    }

                    const payload =
                        toApiFood({
                            date: key,
                            meal: card.meal,
                            time,
                            description
                        });

                    let id;

                    if (existing && existing.id !== null) {

                        await resources.food.update(
                            existing.id,
                            payload
                        );

                        id = existing.id;

                    } else {

                        const created =
                            await resources.food.create(payload);

                        id =
                            idOf(created) ??
                            toList(
                                await resources.food.list({ date: key })
                            )
                                .map(mapFood)
                                .find(item => item.meal === card.meal)
                                ?.id ??
                            null;

                    }

                    if (dateKey(selectedDate) === key) {

                        food.records[card.meal] = {
                            id,
                            meal: card.meal,
                            time,
                            description
                        };

                    }

                    return "saved";

                } catch (error) {

                    reportError(
                        error,
                        "Could not save this meal."
                    );

                    return false;

                }

            }
        );

        if (saved && dateKey(selectedDate) === key) {

            const record = food.records[card.meal];

            card.statusEl.classList.toggle(
                "logged",
                Boolean(record)
            );

            flash(
                card.statusEl,
                saved === "removed" ? "Removed ✓" : "Saved ✓",
                () => mealStatusText(card)
            );

        }

    }


    /* -----------------------------------------------------
       LOAD EVERYTHING FOR THE SELECTED DAY
       ----------------------------------------------------- */

    function setExtrasLoading(isLoading) {

        document
            .querySelectorAll(".extra-card")
            .forEach(
                card => card.classList.toggle("is-loading", isLoading)
            );

    }


    async function loadExtras() {

        const requestId = ++extrasLoadId;

        const key = dateKey(selectedDate);

        setExtrasLoading(true);

        const results =
            await Promise.allSettled([
                ...timedCards.map(
                    card => card.resource.list({ date: key })
                ),
                resources.water.list({ date: key }),
                resources.food.list({ date: key })
            ]);

        /* the user moved to another day while we waited */

        if (requestId !== extrasLoadId) {
            return;
        }

        const failures = [];

        timedCards.forEach(
            (card, index) => {

                const result =
                    readResult(results[index], failures);

                const raw = firstOf(result.value);

                card.record =
                    raw ? mapTimed(raw, card) : null;

                card.loaded = result.ok;

                applyTimed(card);

            }
        );

        const waterResult =
            readResult(results[timedCards.length], failures);

        const waterRaw = firstOf(waterResult.value);

        water.record =
            waterRaw ? mapWater(waterRaw) : null;

        water.loaded = waterResult.ok;

        water.glasses =
            water.record
                ? Math.round(water.record.amountMl / WATER_GLASS_ML)
                : 0;

        water.statusEl.textContent =
            waterStatusText();

        renderWater();

        const foodResult =
            readResult(results[timedCards.length + 1], failures);

        food.records = {};

        toList(foodResult.value)
            .map(mapFood)
            .forEach(
                record => {

                    if (record.meal) {
                        food.records[record.meal] = record;
                    }

                }
            );

        food.loaded = foodResult.ok;

        mealCards.forEach(renderMeal);

        setExtrasLoading(false);

        if (failures.length) {

            console.error(failures);

            showToast(
                failures[0].message ||
                    "Could not load some of today's trackers.",
                {
                    actionLabel: "Retry",
                    onAction: loadExtras
                }
            );

        }

    }


    /* -----------------------------------------------------
       FOLLOW THE SELECTED DAY
       script.js updates the date heading every time the day
       changes, so we watch it instead of editing script.js.
       ----------------------------------------------------- */

    new MutationObserver(loadExtras).observe(
        $("selectedDate"),
        {
            childList: true,
            characterData: true,
            subtree: true
        }
    );


    renderWater();

    loadExtras();

})();