
/**
 * An ordered container of events.
 */
var EventContainer = function() {
};

/**
 * Initialize the event container.
 */
EventContainer.prototype.initEventContainer = function() {
    this.events = [];
    this.insertionPoint = 0;
};

/**
 * Push an event to the top of the event stack.
 * @param {PictureEvent} event Event to push.
 * @param {BaseRasterizer} rasterizer The rasterizer to use.
 *
 */
EventContainer.prototype.pushEvent = function(event, rasterizer) {
    this.events.push(event);
};

/**
 * Insert an event at the current insertion point and increment the insertion
 * point. The event should maintain the rule that events with higher sessionEventIds from the same session are
 * closer to the top of the buffer than events with lower sessionEventIds.
 * @param {PictureEvent} event Event to insert.
 * @param {BaseRasterizer} rasterizer The rasterizer to use.
 * @return {boolean} True if event was inserted to the top of the buffer.
 */
EventContainer.prototype.insertEvent = function(event, rasterizer) {
    var insertToTop = (this.insertionPoint === this.events.length);
    if (insertToTop) {
        this.pushEvent(event, rasterizer);
    } else {
        this.events.splice(this.insertionPoint, 0, event);
    }
    this.setInsertionPoint(this.insertionPoint + 1);
    return insertToTop;
};

/**
 * Change the insertion point.
 * @param {number} insertionPoint The insertion point to set. Must be an integer
 * event index.
 */
EventContainer.prototype.setInsertionPoint = function(insertionPoint) {
    this.insertionPoint = insertionPoint;
};

/**
 * Search for an event in the buffer by session id and session event id.
 * @param {number} searchSid Session identifier. Must be an integer.
 * @param {number} searchSessionEventId An event/session specific identifier.
 * @return {number} Index of the event in the buffer or -1 if not found.
 */
EventContainer.prototype.eventIndexBySessionId = function(searchSid, searchSessionEventId) {
    for (var e = 0; e < this.events.length; e++) {
        if (this.events[e].sid === searchSid) {
            if (this.events[e].sessionEventId === searchSessionEventId) {
                return e;
            } else if (this.events[e].sessionEventId > searchSessionEventId) {
                return -1;
            }
        }
    }
    return -1;
};

/**
 * @param {number} sid Session identifier. Must be an integer.
 * @param {boolean} canBeUndone Whether to consider undone events.
 * @return {number} The index of the latest event added with the given session
 * id or -1 if not found.
 */
EventContainer.prototype.findLatest = function(sid, canBeUndone) {
    var i = this.events.length - 1;
    while (i >= 0) {
        if ((canBeUndone || !this.events[i].undone) &&
            this.events[i].sid === sid) {
            return i;
        }
        i--;
    }
    return -1;
};

export { EventContainer };
