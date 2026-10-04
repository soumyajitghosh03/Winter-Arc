/* =========================================================
   WINTER ARC 2026
   Frontend wired to the backend API.
   No hardcoded data, no browser storage.
   ========================================================= */


/* ---------------------------------------------------------
   CONFIGURATION
   --------------------------------------------------------- */

/* Change this to wherever your backend lives,
   e.g. "http://localhost:3000/api/v1" */
const API_BASE_URL = "http://localhost:5000/api/v1";

const REQUEST_TIMEOUT_MS = 15000;

/* Challenge window (not data, just app configuration) */
const ARC_START = new Date(2026, 9, 1);  // October 1
const ARC_END = new Date(2026, 11, 31);  // December 31

/* Status values the backend expects when WRITING.
   Reading is tolerant (completed / complete / done). */
const STATUS = {
    planned: "planned",
    completed: "completed"
};

/* Add auth headers here if your API needs them,
   e.g. return { Authorization: `Bearer ${token}` }; */
function getAuthHeaders() {
    return {};
}


/* ---------------------------------------------------------
   STATE (in memory only, the backend is the source of truth)
   --------------------------------------------------------- */

let selectedDate = normalizeDate(new Date());

let calendarDate = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    1
);

let selectedActivity = null;   // template picked in the library

let dayLoadId = 0;             // guards against out-of-order responses
let calendarLoadId = 0;
let templatesReady = Promise.resolve();

const state = {
    templates: [],
    templatesLoaded: false,

    activities: [],            // daily activities for selectedDate

    sleepRecord: null,         // { id, date, start, end, duration }
    sleepLoaded: false,

    dailyRecord: null,         // { id, date, note }
    recordLoaded: false,

    calendarSummary: {}        // "YYYY-MM-DD" -> { total, done, hasNote, hasSleep }
};


/* ---------------------------------------------------------
   DOM
   --------------------------------------------------------- */

const elements = {

    dashboard: document.querySelector(".dashboard-grid"),

    currentTime: document.getElementById("currentTime"),
    currentDate: document.getElementById("currentDate"),

    selectedDayName: document.getElementById("selectedDayName"),
    selectedDate: document.getElementById("selectedDate"),
    arcDay: document.getElementById("arcDay"),

    previousDay: document.getElementById("previousDay"),
    nextDay: document.getElementById("nextDay"),

    calendarButton: document.getElementById("calendarButton"),

    sleepStart: document.getElementById("sleepStart"),
    sleepEnd: document.getElementById("sleepEnd"),
    sleepDuration: document.getElementById("sleepDuration"),
    saveSleep: document.getElementById("saveSleep"),

    activityList: document.getElementById("activityList"),
    emptyState: document.getElementById("emptyState"),

    addActivityButton: document.getElementById("addActivityButton"),
    emptyAddButton: document.getElementById("emptyAddButton"),

    progressPercentage: document.getElementById("progressPercentage"),
    progressCircle: document.getElementById("progressCircle"),

    completedCount: document.getElementById("completedCount"),
    completedCountSmall: document.getElementById("completedCountSmall"),
    plannedCount: document.getElementById("plannedCount"),
    remainingCount: document.getElementById("remainingCount"),

    dailyNote: document.getElementById("dailyNote"),
    saveNote: document.getElementById("saveNote"),
    noteStatus: document.getElementById("noteStatus"),

    activityModal: document.getElementById("activityModal"),
    closeActivityModal: document.getElementById("closeActivityModal"),
    activityLibrary: document.getElementById("activityLibrary"),

    customActivityName: document.getElementById("customActivityName"),
    customActivityCategory: document.getElementById("customActivityCategory"),
    customActivityIcon: document.getElementById("customActivityIcon"),
    createActivity: document.getElementById("createActivity"),

    timeModal: document.getElementById("timeModal"),
    closeTimeModal: document.getElementById("closeTimeModal"),

    timeModalTitle: document.getElementById("timeModalTitle"),
    selectedActivityIcon: document.getElementById("selectedActivityIcon"),
    selectedActivityName: document.getElementById("selectedActivityName"),
    selectedActivityCategory: document.getElementById("selectedActivityCategory"),

    activityStart: document.getElementById("activityStart"),
    activityEnd: document.getElementById("activityEnd"),

    confirmActivity: document.getElementById("confirmActivity"),

    calendarModal: document.getElementById("calendarModal"),
    closeCalendarModal: document.getElementById("closeCalendarModal"),

    calendarPrevious: document.getElementById("calendarPrevious"),
    calendarNext: document.getElementById("calendarNext"),

    calendarMonth: document.getElementById("calendarMonth"),
    calendarDays: document.getElementById("calendarDays"),

    calendarToday: document.getElementById("calendarToday"),
    calendarMonthSelect: document.getElementById("calendarMonthSelect"),
    calendarYearSelect: document.getElementById("calendarYearSelect"),
    calendarJumpDate: document.getElementById("calendarJumpDate"),
    calendarJumpGo: document.getElementById("calendarJumpGo")

};


/* ---------------------------------------------------------
   API CLIENT
   --------------------------------------------------------- */

class ApiError extends Error {

    constructor(message, status = 0, details = null) {

        super(message);

        this.name = "ApiError";
        this.status = status;
        this.details = details;

    }

}


function extractErrorMessage(payload) {

    if (!payload) {
        return "";
    }

    if (typeof payload === "string") {
        return payload;
    }

    if (typeof payload.message === "string") {
        return payload.message;
    }

    if (typeof payload.error === "string") {
        return payload.error;
    }

    if (payload.error && typeof payload.error.message === "string") {
        return payload.error.message;
    }

    return "";

}


/* Accepts both bare payloads and { data: ... } envelopes */

function unwrap(payload) {

    if (
        payload &&
        typeof payload === "object" &&
        !Array.isArray(payload) &&
        "data" in payload
    ) {
        return payload.data;
    }

    return payload;

}


async function apiRequest(path, { method = "GET", query, body } = {}) {

    const url = new URL(
        API_BASE_URL + path,
        window.location.href
    );

    if (query) {

        Object.entries(query).forEach(
            ([key, value]) => {

                if (
                    value !== undefined &&
                    value !== null &&
                    value !== ""
                ) {
                    url.searchParams.set(key, value);
                }

            }
        );

    }

    const controller = new AbortController();

    const timer = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
    );

    let response;

    try {

        response = await fetch(
            url,
            {
                method,

                headers: {
                    Accept: "application/json",
                    ...(body !== undefined
                        ? { "Content-Type": "application/json" }
                        : {}),
                    ...getAuthHeaders()
                },

                body:
                    body !== undefined
                        ? JSON.stringify(body)
                        : undefined,

                signal: controller.signal
            }
        );

    } catch (error) {

        throw new ApiError(
            error.name === "AbortError"
                ? "The server took too long to respond."
                : "Cannot reach the server. Check your connection."
        );

    } finally {

        clearTimeout(timer);

    }

    const text = await response.text();

    let payload = null;

    if (text) {

        try {
            payload = JSON.parse(text);
        } catch {
            payload = text;
        }

    }

    if (!response.ok) {

        throw new ApiError(
            extractErrorMessage(payload) ||
                `Request failed (${response.status})`,
            response.status,
            payload
        );

    }

    return unwrap(payload);

}


/* One resource = list / get / create / update / remove */

function createResource(path) {

    const itemPath =
        id => `${path}/${encodeURIComponent(id)}`;

    return {

        list: query =>
            apiRequest(path, { query }),

        get: id =>
            apiRequest(itemPath(id)),

        create: body =>
            apiRequest(path, { method: "POST", body }),

        update: (id, body) =>
            apiRequest(itemPath(id), { method: "PUT", body }),

        remove: id =>
            apiRequest(itemPath(id), { method: "DELETE" })

    };

}


const api = {

    templates:
        createResource("/activity-templates"),

    dailyActivities: {

        ...createResource("/daily-activities"),

        calendar: (from, to) =>
            apiRequest(
                "/daily-activities/calendar",
                { query: { from, to } }
            )

    },

    dailyRecords:
        createResource("/daily-records"),

    sleepRecords:
        createResource("/sleep-records")

};


/* ---------------------------------------------------------
   API MAPPERS
   Everything that depends on your exact field names lives
   here. Reading is tolerant; the request bodies (toApi*)
   are the only place to edit if a field name differs.
   --------------------------------------------------------- */

function isObject(value) {

    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );

}


function idOf(item) {

    if (!isObject(item)) {
        return null;
    }

    return item.id ?? item._id ?? item.uuid ?? null;

}


/* Turns any list-ish response into an array */

function toList(payload) {

    if (Array.isArray(payload)) {
        return payload;
    }

    if (isObject(payload)) {

        const wrapped =
            payload.items ??
            payload.results ??
            payload.records ??
            payload.rows;

        if (Array.isArray(wrapped)) {
            return wrapped;
        }

        return [payload];

    }

    return [];

}


function firstOf(payload) {

    return toList(payload)[0] ?? null;

}


function sameId(a, b) {

    return (
        a !== null &&
        a !== undefined &&
        b !== null &&
        b !== undefined &&
        String(a) === String(b)
    );

}


function isCompletedStatus(item) {

    if (!item) {
        return false;
    }

    if (item.completed === true || item.isCompleted === true) {
        return true;
    }

    return ["completed", "complete", "done"].includes(
        String(item.status ?? "").toLowerCase()
    );

}


/* "07:30:00", "7:30" or an ISO date-time -> "07:30" */

function toTimeInput(value) {

    if (!value) {
        return "";
    }

    const text = String(value);

    const match = text.match(/^(\d{1,2}):(\d{2})/);

    if (match) {
        return `${match[1].padStart(2, "0")}:${match[2]}`;
    }

    const parsed = new Date(text);

    if (isNaN(parsed.getTime())) {
        return "";
    }

    return (
        String(parsed.getHours()).padStart(2, "0") +
        ":" +
        String(parsed.getMinutes()).padStart(2, "0")
    );

}


/* ----- templates ----- */

function mapTemplate(raw) {

    return {
        id: idOf(raw),
        name: raw.name ?? raw.title ?? "Untitled",
        category: raw.category ?? "general",
        icon: raw.icon ?? raw.emoji ?? "📌"
    };

}


function toApiTemplate({ name, category, icon }) {

    return { name, category, icon };

}


/* ----- daily activities ----- */

function mapDailyActivity(raw, fallbackOrder = 0) {

    const nested =
        raw.template ??
        raw.activityTemplate ??
        raw.activity ??
        null;

    const templateId =
        raw.templateId ??
        raw.activityTemplateId ??
        raw.template_id ??
        idOf(nested) ??
        null;

    const template =
        nested ??
        state.templates.find(
            item => sameId(item.id, templateId)
        ) ??
        {};

    return {

        id: idOf(raw),

        templateId,

        title:
            raw.title ??
            raw.name ??
            template.name ??
            "Activity",

        icon:
            raw.icon ??
            template.icon ??
            "📌",

        category:
            raw.category ??
            template.category ??
            "general",

        startTime:
            toTimeInput(raw.startTime ?? raw.start_time),

        endTime:
            toTimeInput(raw.endTime ?? raw.end_time),

        status:
            isCompletedStatus(raw)
                ? "completed"
                : "planned",

        order:
            raw.order ??
            raw.sortOrder ??
            raw.position ??
            fallbackOrder

    };

}


function toApiDailyActivity(activity, date) {

    return {

        date,

        activityId: activity.templateId,

        startTime: activity.startTime || null,

        endTime: activity.endTime || null,

        status:
            activity.status === "completed"
                ? STATUS.completed
                : STATUS.planned,

        order: activity.order

    };

}


/* ----- sleep ----- */

function mapSleep(raw) {

    return {

        id: idOf(raw),

        date: raw.date ?? null,

        start:
            toTimeInput(
                raw.sleepStart ??
                raw.startTime ??
                raw.start ??
                raw.sleep_start ??
                raw.bedTime
            ),

        end:
            toTimeInput(
                raw.wakeUp ??
                raw.sleepEnd ??
                raw.endTime ??
                raw.end ??
                raw.wake_time ??
                raw.wakeTime
            ),

        duration:
            Number(
                raw.duration ??
                raw.durationMinutes ??
                raw.totalMinutes ??
                0
            ) || 0

    };

}


function toApiSleep({ date, start, end, duration }) {

    return {
        date,
        startTime: start,
        endTime: end,
        duration
    };

}


/* ----- daily record (note) ----- */

function mapDailyRecord(raw) {

    return {

        id: idOf(raw),

        date: raw.date ?? null,

        note:
            raw.note ??
            raw.notes ??
            raw.reflection ??
            raw.content ??
            ""

    };

}


function toApiDailyRecord({ date, note }) {

    return { date, note };

}


/* ----- calendar summary ----- */

function normalizeCalendarSummary(payload) {

    const summary = {};

    const ensure = key => {

        if (!summary[key]) {

            summary[key] = {
                total: 0,
                done: 0,
                hasNote: false,
                hasSleep: false
            };

        }

        return summary[key];

    };

    const countActivity = (key, activity) => {

        const entry = ensure(key);

        entry.total += 1;

        if (isCompletedStatus(activity)) {
            entry.done += 1;
        }

    };

    /* Collect entries from an array or a { date: value } object */

    let source = payload;

    if (isObject(payload)) {

        const wrapped =
            payload.days ??
            payload.items ??
            payload.results ??
            payload.records ??
            payload.rows;

        if (Array.isArray(wrapped)) {
            source = wrapped;
        }

    }

    const entries = [];

    if (Array.isArray(source)) {

        entries.push(...source);

    } else if (isObject(source)) {

        Object.entries(source).forEach(
            ([date, value]) => {

                if (Array.isArray(value)) {

                    value.forEach(
                        item => entries.push({ date, ...item })
                    );

                } else if (isObject(value)) {

                    entries.push({ date, ...value });

                } else if (typeof value === "number") {

                    entries.push({ date, total: value });

                }

            }
        );

    }

    entries.forEach(
        entry => {

            if (!isObject(entry)) {
                return;
            }

            const key =
                String(entry.date ?? entry.day ?? "")
                    .slice(0, 10);

            if (!key) {
                return;
            }

            const record = ensure(key);

            if (Array.isArray(entry.activities)) {

                entry.activities.forEach(
                    activity => countActivity(key, activity)
                );

            } else {

                const total = Number(
                    entry.total ??
                    entry.totalActivities ??
                    entry.planned ??
                    entry.count ??
                    entry.activityCount
                );

                if (!isNaN(total)) {

                    const done = Number(
                        entry.completed ??
                        entry.completedActivities ??
                        entry.done ??
                        entry.completedCount ??
                        0
                    );

                    record.total += total;
                    record.done += isNaN(done) ? 0 : done;

                } else {

                    /* one row per activity */
                    countActivity(key, entry);

                }

            }

            if (entry.hasNote) {
                record.hasNote = true;
            }

            if (entry.hasSleep) {
                record.hasSleep = true;
            }

        }
    );

    return summary;

}


/* ---------------------------------------------------------
   UI FEEDBACK (toasts, loading, busy buttons)
   --------------------------------------------------------- */

function showToast(
    message,
    { type = "error", actionLabel, onAction, duration } = {}
) {

    let container =
        document.getElementById("toastContainer");

    if (!container) {

        container = document.createElement("div");

        container.id = "toastContainer";

        container.className = "toast-container";

        document.body.appendChild(container);

    }

    const toast = document.createElement("div");

    toast.className = `toast toast-${type}`;

    toast.setAttribute(
        "role",
        type === "error" ? "alert" : "status"
    );

    const text = document.createElement("span");

    text.textContent = message;

    toast.appendChild(text);

    if (actionLabel && onAction) {

        const action = document.createElement("button");

        action.className = "toast-action";

        action.textContent = actionLabel;

        action.addEventListener(
            "click",
            () => {

                toast.remove();

                onAction();

            }
        );

        toast.appendChild(action);

    }

    container.appendChild(toast);

    setTimeout(
        () => toast.remove(),
        duration ?? (type === "error" ? 6000 : 2500)
    );

}


function reportError(error, fallback) {

    console.error(error);

    showToast(
        (error && error.message) || fallback
    );

}


function setDashboardLoading(isLoading) {

    elements.dashboard.classList.toggle(
        "is-loading",
        isLoading
    );

    elements.dashboard.setAttribute(
        "aria-busy",
        String(isLoading)
    );

}


/* Disables a button while its request is running */

async function withButton(button, pendingLabel, task) {

    if (button.disabled) {
        return undefined;
    }

    const original = button.textContent;

    button.disabled = true;

    if (pendingLabel) {
        button.textContent = pendingLabel;
    }

    try {

        return await task();

    } finally {

        button.disabled = false;

        if (pendingLabel) {
            button.textContent = original;
        }

    }

}


/* ---------------------------------------------------------
   DATE HELPERS
   --------------------------------------------------------- */

function normalizeDate(date) {

    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );

}


function dateKey(date) {

    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;

}


function formatDate(date) {

    return date.toLocaleDateString(
        "en-US",
        {
            month: "long",
            day: "numeric",
            year: "numeric"
        }
    );

}


function formatDay(date) {

    return date.toLocaleDateString(
        "en-US",
        {
            weekday: "long"
        }
    );

}


function getArcDay(date) {

    const start = normalizeDate(ARC_START);

    const current = normalizeDate(date);

    const difference =
        current.getTime() - start.getTime();

    return (
        Math.floor(
            difference / (1000 * 60 * 60 * 24)
        ) + 1
    );

}


function isWithinArc(date) {

    const current = normalizeDate(date);

    return (
        current >= normalizeDate(ARC_START) &&
        current <= normalizeDate(ARC_END)
    );

}


/* ---------------------------------------------------------
   CLOCK
   --------------------------------------------------------- */

function updateClock() {

    const now = new Date();

    elements.currentTime.textContent =
        now.toLocaleTimeString(
            "en-US",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );

    elements.currentDate.textContent =
        now.toLocaleDateString(
            "en-US",
            {
                weekday: "long",
                month: "short",
                day: "numeric"
            }
        );

}


setInterval(updateClock, 1000);

updateClock();


/* ---------------------------------------------------------
   RENDER DATE
   --------------------------------------------------------- */

function renderDate() {

    elements.selectedDayName.textContent =
        formatDay(selectedDate);

    elements.selectedDate.textContent =
        formatDate(selectedDate);

    const day = getArcDay(selectedDate);

    elements.arcDay.textContent =
        day >= 1 && day <= 92
            ? `Day ${day}`
            : "Outside Winter Arc";

    loadDayData();

}


/* ---------------------------------------------------------
   LOAD DAY (activities + sleep + note, in parallel)
   --------------------------------------------------------- */

async function loadDayData() {

    const requestId = ++dayLoadId;

    const key = dateKey(selectedDate);

    setDashboardLoading(true);

    const [activitiesResult, sleepResult, recordResult] =
        await Promise.allSettled([
            api.dailyActivities.list({ date: key }),
            api.sleepRecords.list({ date: key }),
            api.dailyRecords.list({ date: key })
        ]);

    /* activities may need template details */

    await templatesReady;

    /* the user moved to another day while we waited */

    if (requestId !== dayLoadId) {
        return;
    }

    const failures = [];

    /* a 404 simply means "nothing saved for this day" */

    const read = result => {

        if (result.status === "fulfilled") {
            return { ok: true, value: result.value };
        }

        if (result.reason && result.reason.status === 404) {
            return { ok: true, value: null };
        }

        failures.push(result.reason);

        return { ok: false, value: null };

    };

    const activities = read(activitiesResult);
    const sleep = read(sleepResult);
    const record = read(recordResult);

    state.activities =
        toList(activities.value)
            .map((item, index) => mapDailyActivity(item, index))
            .sort((a, b) => a.order - b.order);

    const sleepRaw = firstOf(sleep.value);

    state.sleepRecord =
        sleepRaw ? mapSleep(sleepRaw) : null;

    state.sleepLoaded = sleep.ok;

    const recordRaw = firstOf(record.value);

    state.dailyRecord =
        recordRaw ? mapDailyRecord(recordRaw) : null;

    state.recordLoaded = record.ok;

    elements.sleepStart.value =
        state.sleepRecord ? state.sleepRecord.start : "";

    elements.sleepEnd.value =
        state.sleepRecord ? state.sleepRecord.end : "";

    calculateSleep();

    elements.dailyNote.value =
        state.dailyRecord ? state.dailyRecord.note : "";

    elements.noteStatus.textContent =
        state.dailyRecord && state.dailyRecord.note
            ? "Saved"
            : "Unsaved";

    renderActivities();

    updateProgress();

    setDashboardLoading(false);

    if (failures.length) {

        console.error(failures);

        showToast(
            failures[0].message || "Could not load this day.",
            {
                actionLabel: "Retry",
                onAction: loadDayData
            }
        );

    }

}


/* ---------------------------------------------------------
   DATE NAVIGATION
   --------------------------------------------------------- */

elements.previousDay.addEventListener(
    "click",
    () => {

        selectedDate.setDate(
            selectedDate.getDate() - 1
        );

        renderDate();

    }
);


elements.nextDay.addEventListener(
    "click",
    () => {

        selectedDate.setDate(
            selectedDate.getDate() + 1
        );

        renderDate();

    }
);


/* ---------------------------------------------------------
   SLEEP
   --------------------------------------------------------- */

function calculateSleep() {

    const start =
        elements.sleepStart.value;

    const end =
        elements.sleepEnd.value;

    if (!start || !end) {

        elements.sleepDuration.textContent = "—";

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

    if (endMinutes <= startMinutes) {

        endMinutes += 24 * 60;

    }

    const duration =
        endMinutes - startMinutes;

    elements.sleepDuration.textContent =
        formatDuration(duration);

    return duration;

}


function formatDuration(minutes) {

    if (!minutes) {
        return "—";
    }

    const hours =
        Math.floor(minutes / 60);

    const remaining =
        minutes % 60;

    return `${hours}h ${String(remaining).padStart(2, "0")}m`;

}


elements.sleepStart.addEventListener(
    "change",
    calculateSleep
);


elements.sleepEnd.addEventListener(
    "change",
    calculateSleep
);


elements.saveSleep.addEventListener(
    "click",
    async () => {

        if (!state.sleepLoaded) {

            showToast(
                "Sleep data didn't load for this day. Reload it before saving.",
                {
                    actionLabel: "Reload",
                    onAction: loadDayData
                }
            );

            return;

        }

        const start = elements.sleepStart.value;
        const end = elements.sleepEnd.value;

        if (!start || !end) {

            showToast(
                "Set both sleep start and wake up time.",
                { type: "info" }
            );

            return;

        }

        const key = dateKey(selectedDate);

        const duration = calculateSleep();

        const saved = await withButton(
            elements.saveSleep,
            "Saving...",
            async () => {

                try {

                    const payload =
                        toApiSleep({ date: key, start, end, duration });

                    const existing = state.sleepRecord;

                    let id;

                    if (existing && existing.id !== null) {

                        await api.sleepRecords.update(
                            existing.id,
                            payload
                        );

                        id = existing.id;

                    } else {

                        const created =
                            await api.sleepRecords.create(payload);

                        id =
                            idOf(created) ??
                            idOf(
                                firstOf(
                                    await api.sleepRecords.list({ date: key })
                                )
                            );

                    }

                    if (dateKey(selectedDate) === key) {

                        state.sleepRecord = {
                            id,
                            date: key,
                            start,
                            end,
                            duration
                        };

                    }

                    return true;

                } catch (error) {

                    reportError(
                        error,
                        "Could not save sleep."
                    );

                    return false;

                }

            }
        );

        if (saved && dateKey(selectedDate) === key) {

            elements.sleepDuration.textContent =
                formatDuration(duration);

            elements.saveSleep.textContent =
                "Saved ✓";

            setTimeout(
                () => {
                    elements.saveSleep.textContent =
                        "Save sleep";
                },
                1200
            );

        }

    }
);


/* ---------------------------------------------------------
   ACTIVITY LIBRARY (templates from the API)
   --------------------------------------------------------- */

async function loadTemplates() {

    try {

        state.templates =
            toList(await api.templates.list())
                .map(mapTemplate);

        state.templatesLoaded = true;

    } catch (error) {

        state.templatesLoaded = false;

        console.error(error);

        showToast(
            error.message || "Could not load the activity library.",
            {
                actionLabel: "Retry",
                onAction: () => {
                    templatesReady = loadTemplates();
                }
            }
        );

    }

    renderActivityLibrary();

}


function renderActivityLibrary() {

    elements.activityLibrary.innerHTML = "";

    if (!state.templates.length) {

        const message = document.createElement("div");

        message.className = "library-empty";

        message.textContent =
            state.templatesLoaded
                ? "No activities yet. Create your first one below."
                : "The activity library isn't available right now.";

        elements.activityLibrary.appendChild(message);

        return;

    }

    state.templates.forEach(
        template => {

            const button =
                document.createElement("button");

            button.className =
                "activity-option";

            button.innerHTML = `

                <div class="activity-option-icon">
                    ${escapeHtml(template.icon)}
                </div>

                <span class="activity-option-name">
                    ${escapeHtml(template.name)}
                </span>

                <span class="activity-option-category">
                    ${escapeHtml(template.category)}
                </span>

            `;

            button.addEventListener(
                "click",
                () => {

                    openTimeModal(template);

                }
            );

            elements.activityLibrary.appendChild(
                button
            );

        }
    );

}


/* ---------------------------------------------------------
   DAILY ACTIVITIES
   --------------------------------------------------------- */

function renderActivities() {

    if (!state.activities.length) {

        elements.activityList.innerHTML = "";

        elements.activityList.appendChild(
            elements.emptyState
        );

        elements.emptyState.style.display =
            "flex";

        return;

    }

    elements.emptyState.style.display =
        "none";

    elements.activityList.innerHTML = "";

    [...state.activities]
        .sort(
            (a, b) =>
                a.order - b.order
        )
        .forEach(
            activity => {

                const item =
                    document.createElement("div");

                item.className =
                    "activity-item";

                if (activity.status === "completed") {

                    item.classList.add(
                        "completed"
                    );

                }

                item.innerHTML = `

                    <div class="activity-icon">
                        ${escapeHtml(activity.icon)}
                    </div>

                    <div>
                        <div class="activity-name">
                            ${escapeHtml(activity.title)}
                        </div>

                        <div class="activity-category">
                            ${escapeHtml(activity.category)}
                        </div>
                    </div>

                    <div class="activity-time">
                        ${escapeHtml(activity.startTime || "--:--")}
                        →
                        ${escapeHtml(activity.endTime || "--:--")}
                    </div>

                    <button
                        class="complete-button"
                        title="Toggle completion"
                    >
                        ${activity.status === "completed" ? "✓" : ""}
                    </button>

                    <button
                        class="delete-button"
                        title="Delete activity"
                        aria-label="Delete activity"
                    >
                        ×
                    </button>

                `;

                const completeButton =
                    item.querySelector(".complete-button");

                completeButton.addEventListener(
                    "click",
                    () => {

                        toggleActivity(
                            activity.id,
                            completeButton
                        );

                    }
                );

                const deleteButton =
                    item.querySelector(".delete-button");

                deleteButton.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        deleteActivity(
                            activity.id,
                            deleteButton
                        );

                    }
                );

                /* Double click to edit */

                item.addEventListener(
                    "dblclick",
                    () => {

                        editActivity(
                            activity.id
                        );

                    }
                );

                elements.activityList.appendChild(
                    item
                );

            }
        );

}


/* ---------------------------------------------------------
   ACTIVITY MODAL
   --------------------------------------------------------- */

function openActivityModal() {

    renderActivityLibrary();

    elements.activityModal.classList.add(
        "active"
    );

    /* library failed earlier? try again */

    if (!state.templatesLoaded) {

        templatesReady = loadTemplates();

    }

}


function closeActivityModal() {

    elements.activityModal.classList.remove(
        "active"
    );

}


elements.addActivityButton.addEventListener(
    "click",
    openActivityModal
);


elements.emptyAddButton.addEventListener(
    "click",
    openActivityModal
);


elements.closeActivityModal.addEventListener(
    "click",
    closeActivityModal
);


/* ---------------------------------------------------------
   TIME MODAL
   --------------------------------------------------------- */

function openTimeModal(template) {

    selectedActivity = template;

    elements.timeModalTitle.textContent =
        template.name;

    elements.selectedActivityName.textContent =
        template.name;

    elements.selectedActivityIcon.textContent =
        template.icon;

    elements.selectedActivityCategory.textContent =
        template.category;

    elements.activityStart.value = "";

    elements.activityEnd.value = "";

    closeActivityModal();

    elements.timeModal.classList.add(
        "active"
    );

}


function closeTimeModal() {

    elements.timeModal.classList.remove(
        "active"
    );

    selectedActivity = null;

}


elements.closeTimeModal.addEventListener(
    "click",
    closeTimeModal
);


elements.confirmActivity.addEventListener(
    "click",
    async () => {

        if (!selectedActivity) {
            return;
        }

        const template = selectedActivity;

        const key = dateKey(selectedDate);

        const nextOrder =
            state.activities.length
                ? Math.max(...state.activities.map(a => a.order)) + 1
                : 0;

        const draft = {
            templateId: template.id,
            startTime: elements.activityStart.value,
            endTime: elements.activityEnd.value,
            status: "planned",
            order: nextOrder
        };

        await withButton(
            elements.confirmActivity,
            "Adding...",
            async () => {

                try {

                    const payload =
                        toApiDailyActivity(draft, key);

                    const saved =
                        await api.dailyActivities.create(payload);

                    closeTimeModal();

                    if (dateKey(selectedDate) !== key) {
                        return;
                    }

                    const created = mapDailyActivity(
                        {
                            ...payload,
                            ...(isObject(saved) ? saved : {})
                        },
                        nextOrder
                    );

                    if (created.id === null) {

                        /* backend didn't echo the new row; reload */

                        await loadDayData();

                        return;

                    }

                    state.activities.push(created);

                    renderActivities();

                    updateProgress();

                } catch (error) {

                    reportError(
                        error,
                        "Could not add the activity."
                    );

                }

            }
        );

    }
);


/* ---------------------------------------------------------
   ACTIVITY COMPLETION
   --------------------------------------------------------- */

async function toggleActivity(id, button) {

    const activity =
        state.activities.find(
            item => sameId(item.id, id)
        );

    if (!activity) {
        return;
    }

    const key = dateKey(selectedDate);

    const nextStatus =
        activity.status === "completed"
            ? "planned"
            : "completed";

    await withButton(
        button,
        null,
        async () => {

            try {

                await api.dailyActivities.update(
                    id,
                    toApiDailyActivity(
                        { ...activity, status: nextStatus },
                        key
                    )
                );

                activity.status = nextStatus;

                renderActivities();

                updateProgress();

            } catch (error) {

                reportError(
                    error,
                    "Could not update the activity."
                );

            }

        }
    );

}


/* ---------------------------------------------------------
   ACTIVITY DELETE
   --------------------------------------------------------- */

async function deleteActivity(id, button) {

    const activity =
        state.activities.find(
            item => sameId(item.id, id)
        );

    if (!activity) {
        return;
    }

    if (
        !confirm(
            `Remove "${activity.title}" from this day?`
        )
    ) {
        return;
    }

    await withButton(
        button,
        null,
        async () => {

            try {

                await api.dailyActivities.remove(id);

                state.activities =
                    state.activities.filter(
                        item => !sameId(item.id, id)
                    );

                renderActivities();

                updateProgress();

            } catch (error) {

                reportError(
                    error,
                    "Could not delete the activity."
                );

            }

        }
    );

}


/* ---------------------------------------------------------
   ACTIVITY EDIT
   --------------------------------------------------------- */

function parseTimeInput(text) {

    const value = text.trim();

    if (!value) {
        return "";
    }

    const match =
        value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);

    if (!match) {
        return null;
    }

    return `${match[1].padStart(2, "0")}:${match[2]}`;

}


async function editActivity(id) {

    const activity =
        state.activities.find(
            item => sameId(item.id, id)
        );

    if (!activity) {
        return;
    }

    const newStart =
        prompt(
            "Start time (HH:MM)",
            activity.startTime || ""
        );

    if (newStart === null) {
        return;
    }

    const newEnd =
        prompt(
            "End time (HH:MM)",
            activity.endTime || ""
        );

    if (newEnd === null) {
        return;
    }

    const startTime = parseTimeInput(newStart);
    const endTime = parseTimeInput(newEnd);

    if (startTime === null || endTime === null) {

        showToast("Use the 24-hour format HH:MM, e.g. 07:30.");

        return;

    }

    const key = dateKey(selectedDate);

    try {

        await api.dailyActivities.update(
            id,
            toApiDailyActivity(
                { ...activity, startTime, endTime },
                key
            )
        );

        activity.startTime = startTime;

        activity.endTime = endTime;

        renderActivities();

    } catch (error) {

        reportError(
            error,
            "Could not update the activity."
        );

    }

}


/* ---------------------------------------------------------
   CUSTOM ACTIVITY (creates a template)
   --------------------------------------------------------- */

elements.createActivity.addEventListener(
    "click",
    async () => {

        const name =
            elements.customActivityName
                .value
                .trim();

        if (!name) {

            showToast(
                "Please enter an activity name.",
                { type: "info" }
            );

            return;

        }

        const payload = toApiTemplate({
            name,
            category: elements.customActivityCategory.value,
            icon: elements.customActivityIcon.value.trim() || "📌"
        });

        await withButton(
            elements.createActivity,
            "Creating...",
            async () => {

                try {

                    const saved =
                        await api.templates.create(payload);

                    const template = mapTemplate({
                        ...payload,
                        ...(isObject(saved) ? saved : {})
                    });

                    if (template.id === null) {

                        await loadTemplates();

                    } else {

                        state.templates.push(template);

                    }

                    state.templatesLoaded = true;

                    elements.customActivityName.value = "";

                    elements.customActivityIcon.value = "";

                    renderActivityLibrary();

                } catch (error) {

                    reportError(
                        error,
                        "Could not create the activity."
                    );

                }

            }
        );

    }
);


/* ---------------------------------------------------------
   PROGRESS
   --------------------------------------------------------- */

function updateProgress() {

    const total =
        state.activities.length;

    const completed =
        state.activities.filter(
            activity =>
                activity.status === "completed"
        ).length;

    const remaining =
        total - completed;

    const percentage =
        total === 0
            ? 0
            : Math.round(
                (completed / total) * 100
            );

    elements.progressPercentage.textContent =
        `${percentage}%`;

    elements.completedCount.textContent =
        completed;

    elements.completedCountSmall.textContent =
        completed;

    elements.plannedCount.textContent =
        total;

    elements.remainingCount.textContent =
        remaining;

    const circumference =
        314;

    const offset =
        circumference -
        (percentage / 100) * circumference;

    elements.progressCircle.style.strokeDashoffset =
        offset;

}


/* ---------------------------------------------------------
   DAILY NOTE
   --------------------------------------------------------- */

elements.saveNote.addEventListener(
    "click",
    async () => {

        if (!state.recordLoaded) {

            showToast(
                "This day's note didn't load. Reload it before saving.",
                {
                    actionLabel: "Reload",
                    onAction: loadDayData
                }
            );

            return;

        }

        const key = dateKey(selectedDate);

        const note = elements.dailyNote.value;

        const existing = state.dailyRecord;

        if (!existing && !note.trim()) {

            elements.noteStatus.textContent =
                "Nothing to save";

            setTimeout(
                () => {
                    elements.noteStatus.textContent =
                        "Unsaved";
                },
                1200
            );

            return;

        }

        const saved = await withButton(
            elements.saveNote,
            "Saving...",
            async () => {

                try {

                    const payload =
                        toApiDailyRecord({ date: key, note });

                    let id;

                    if (existing && existing.id !== null) {

                        await api.dailyRecords.update(
                            existing.id,
                            payload
                        );

                        id = existing.id;

                    } else {

                        const created =
                            await api.dailyRecords.create(payload);

                        id =
                            idOf(created) ??
                            idOf(
                                firstOf(
                                    await api.dailyRecords.list({ date: key })
                                )
                            );

                    }

                    if (dateKey(selectedDate) === key) {

                        state.dailyRecord = {
                            id,
                            date: key,
                            note
                        };

                    }

                    return true;

                } catch (error) {

                    reportError(
                        error,
                        "Could not save the note."
                    );

                    return false;

                }

            }
        );

        if (saved && dateKey(selectedDate) === key) {

            elements.noteStatus.textContent =
                "Saved ✓";

            setTimeout(
                () => {

                    elements.noteStatus.textContent =
                        note
                            ? "Saved"
                            : "Unsaved";

                },
                1200
            );

        }

    }
);


/* ---------------------------------------------------------
   CALENDAR PAGE
   --------------------------------------------------------- */

/* Fill the month / year pickers once */

function populateCalendarPickers() {

    elements.calendarMonthSelect.innerHTML = "";

    for (let month = 0; month < 12; month++) {

        const option =
            document.createElement("option");

        option.value = month;

        option.textContent =
            new Date(2000, month, 1)
                .toLocaleDateString(
                    "en-US",
                    { month: "long" }
                );

        elements.calendarMonthSelect.appendChild(
            option
        );

    }

    elements.calendarYearSelect.innerHTML = "";

    const thisYear =
        new Date().getFullYear();

    for (let year = thisYear - 2; year <= thisYear + 9; year++) {

        ensureYearOption(year);

    }

}


function ensureYearOption(year) {

    const options =
        Array.from(
            elements.calendarYearSelect.options
        );

    if (options.some(option => Number(option.value) === year)) {
        return;
    }

    const option =
        document.createElement("option");

    option.value = year;

    option.textContent = year;

    /* keep years in ascending order */

    const next =
        options.find(
            existing =>
                Number(existing.value) > year
        );

    elements.calendarYearSelect.insertBefore(
        option,
        next || null
    );

}


elements.calendarButton.addEventListener(
    "click",
    openCalendar
);


function openCalendar() {

    calendarDate =
        new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            1
        );

    elements.calendarJumpDate.value =
        dateKey(selectedDate);

    renderCalendar();

    elements.calendarModal.classList.add(
        "active"
    );

    elements.calendarModal.scrollTop = 0;

}


function closeCalendar() {

    elements.calendarModal.classList.remove(
        "active"
    );

}


function jumpToDate(date) {

    selectedDate =
        normalizeDate(date);

    renderDate();

    closeCalendar();

}


elements.closeCalendarModal.addEventListener(
    "click",
    closeCalendar
);


elements.calendarPrevious.addEventListener(
    "click",
    () => {

        calendarDate.setMonth(
            calendarDate.getMonth() - 1
        );

        renderCalendar();

    }
);


elements.calendarNext.addEventListener(
    "click",
    () => {

        calendarDate.setMonth(
            calendarDate.getMonth() + 1
        );

        renderCalendar();

    }
);


elements.calendarToday.addEventListener(
    "click",
    () => {

        jumpToDate(
            new Date()
        );

    }
);


elements.calendarMonthSelect.addEventListener(
    "change",
    () => {

        calendarDate =
            new Date(
                calendarDate.getFullYear(),
                Number(
                    elements.calendarMonthSelect.value
                ),
                1
            );

        renderCalendar();

    }
);


elements.calendarYearSelect.addEventListener(
    "change",
    () => {

        calendarDate =
            new Date(
                Number(
                    elements.calendarYearSelect.value
                ),
                calendarDate.getMonth(),
                1
            );

        renderCalendar();

    }
);


function jumpFromDateInput() {

    const value =
        elements.calendarJumpDate.value;

    if (!value) {

        elements.calendarJumpDate.focus();

        return;

    }

    const [year, month, day] =
        value.split("-").map(Number);

    const date =
        new Date(
            year,
            month - 1,
            day
        );

    if (isNaN(date.getTime())) {
        return;
    }

    jumpToDate(date);

}


elements.calendarJumpGo.addEventListener(
    "click",
    jumpFromDateInput
);


elements.calendarJumpDate.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            jumpFromDateInput();

        }

    }
);


/* First and last visible cell of the 6-week grid */

function getCalendarRange() {

    const year =
        calendarDate.getFullYear();

    const month =
        calendarDate.getMonth();

    /* Monday = 0 */

    let startingDay =
        new Date(year, month, 1).getDay() - 1;

    if (startingDay < 0) {
        startingDay = 6;
    }

    return {

        startingDay,

        from: new Date(year, month, 1 - startingDay),

        to: new Date(year, month, 1 - startingDay + 41)

    };

}


function renderCalendar() {

    elements.calendarMonth.textContent =
        calendarDate.toLocaleDateString(
            "en-US",
            {
                month: "long",
                year: "numeric"
            }
        );

    /* keep the pickers in sync */

    const year =
        calendarDate.getFullYear();

    ensureYearOption(year);

    elements.calendarMonthSelect.value =
        calendarDate.getMonth();

    elements.calendarYearSelect.value =
        year;

    buildCalendarGrid();

    loadCalendarSummary();

}


/* Fetches per-day activity counts for the visible grid */

async function loadCalendarSummary() {

    const requestId = ++calendarLoadId;

    const { from, to } = getCalendarRange();

    elements.calendarDays.classList.add("is-loading");

    try {

        const payload =
            await api.dailyActivities.calendar(
                dateKey(from),
                dateKey(to)
            );

        if (requestId !== calendarLoadId) {
            return;
        }

        /* drop old values for this range, then apply fresh ones */

        for (
            let cursor = new Date(from);
            cursor <= to;
            cursor.setDate(cursor.getDate() + 1)
        ) {

            delete state.calendarSummary[dateKey(cursor)];

        }

        Object.assign(
            state.calendarSummary,
            normalizeCalendarSummary(payload)
        );

        buildCalendarGrid();

    } catch (error) {

        if (requestId === calendarLoadId) {

            reportError(
                error,
                "Could not load calendar activity."
            );

        }

    } finally {

        if (requestId === calendarLoadId) {

            elements.calendarDays.classList.remove("is-loading");

        }

    }

}


function buildCalendarGrid() {

    elements.calendarDays.innerHTML =
        "";

    const year =
        calendarDate.getFullYear();

    const month =
        calendarDate.getMonth();

    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();

    const { startingDay } =
        getCalendarRange();


    /* Previous month days */

    const previousMonthDays =
        new Date(
            year,
            month,
            0
        ).getDate();

    for (
        let i = startingDay - 1;
        i >= 0;
        i--
    ) {

        const dayNumber =
            previousMonthDays - i;

        elements.calendarDays.appendChild(
            createCalendarDay(
                dayNumber,
                new Date(
                    year,
                    month - 1,
                    dayNumber
                ),
                true
            )
        );

    }


    /* Current month */

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        elements.calendarDays.appendChild(
            createCalendarDay(
                day,
                new Date(
                    year,
                    month,
                    day
                ),
                false
            )
        );

    }


    /* Next month */

    const totalCells =
        42;

    let currentCells =
        startingDay + daysInMonth;

    for (
        let day = 1;
        currentCells < totalCells;
        day++
    ) {

        elements.calendarDays.appendChild(
            createCalendarDay(
                day,
                new Date(
                    year,
                    month + 1,
                    day
                ),
                true
            )
        );

        currentCells++;

    }

}


function createCalendarDay(
    dayNumber,
    date,
    otherMonth
) {

    const button =
        document.createElement("button");

    button.className =
        "calendar-day";

    button.title =
        formatDate(date);

    if (otherMonth) {

        button.classList.add(
            "other-month"
        );

    }


    const today =
        normalizeDate(
            new Date()
        );

    if (
        date.getTime() ===
        today.getTime()
    ) {

        button.classList.add(
            "today"
        );

    }


    const key =
        dateKey(date);

    const isSelected =
        key === dateKey(selectedDate);

    if (isSelected) {

        button.classList.add(
            "selected"
        );

    }


    /* Data: API summary, with live values for the open day */

    const summary =
        state.calendarSummary[key] || {};

    let total = summary.total || 0;
    let done = summary.done || 0;
    let hasNote = Boolean(summary.hasNote);
    let hasSleep = Boolean(summary.hasSleep);

    if (isSelected) {

        total = state.activities.length;

        done =
            state.activities.filter(
                activity =>
                    activity.status === "completed"
            ).length;

        hasNote = Boolean(
            state.dailyRecord &&
            state.dailyRecord.note &&
            state.dailyRecord.note.trim()
        );

        hasSleep = Boolean(
            state.sleepRecord &&
            state.sleepRecord.start
        );

    }

    if (total || hasNote || hasSleep) {

        button.classList.add(
            "has-data"
        );

    }


    const inArc =
        isWithinArc(date);

    if (inArc) {

        button.classList.add(
            "in-arc"
        );

    }


    /* Cell content */

    const arcLabel =
        inArc
            ? `<span class="day-arc">D${getArcDay(date)}</span>`
            : "";

    const flags =
        (hasSleep ? "🌙" : "") +
        (hasNote ? "✍️" : "");

    let html = `

        <span class="day-top">
            <span class="day-num">${dayNumber}</span>
            ${arcLabel}
        </span>

    `;

    if (total) {

        const percentage =
            Math.round(
                (done / total) * 100
            );

        html += `

            <span class="day-meta">
                <span>${done}/${total} done</span>
                <span class="day-flags">${flags}</span>
            </span>

            <span class="day-bar">
                <i style="width: ${percentage}%"></i>
            </span>

        `;

    } else if (flags) {

        html += `

            <span class="day-meta">
                <span></span>
                <span class="day-flags">${flags}</span>
            </span>

        `;

    }

    button.innerHTML =
        html;


    button.addEventListener(
        "click",
        () => {

            jumpToDate(
                date
            );

        }
    );


    return button;

}


/* ---------------------------------------------------------
   ESCAPE HTML
   --------------------------------------------------------- */

function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;

}


/* ---------------------------------------------------------
   CLOSE MODALS ON BACKDROP
   --------------------------------------------------------- */

document
    .querySelectorAll(".modal-overlay")
    .forEach(
        overlay => {

            overlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target === overlay
                    ) {

                        overlay.classList.remove(
                            "active"
                        );

                    }

                }
            );

        }
    );


/* ---------------------------------------------------------
   CLOSE WITH ESCAPE
   --------------------------------------------------------- */

document.addEventListener(
    "keydown",
    event => {

        if (event.key !== "Escape") {
            return;
        }

        if (elements.calendarModal.classList.contains("active")) {

            closeCalendar();

            return;

        }

        if (elements.timeModal.classList.contains("active")) {

            closeTimeModal();

            return;

        }

        if (elements.activityModal.classList.contains("active")) {

            closeActivityModal();

        }

    }
);


/* ---------------------------------------------------------
   INITIALIZE
   --------------------------------------------------------- */

templatesReady = loadTemplates();

populateCalendarPickers();

renderDate();