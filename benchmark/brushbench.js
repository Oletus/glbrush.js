/*
 * Copyright Olli Etuaho 2014-2019.
 */

import { Rect } from '../src/math/rect.js';

import { Vec2 } from '../src/math/vec2.js';

import { BlendingMode } from '../src/util/blending_mode.js';

import { PictureEvent } from '../src/picture_event.js';

import { Picture } from '../src/picture.js';

import { PictureRenderer } from '../src/picture_renderer.js';

var testTextureCanvas = function() {
    var image = document.createElement('canvas');
    image.width = 128;
    image.height = 128;
    var ctx = image.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 3; // Slight blurriness is required for an antialiased look
    ctx.fillRect(5, 5, 40, 40);
    ctx.fillRect(59, 59, 64, 64);
    ctx.fillRect(20, 84, 20, 20);
    ctx.fillRect(84, 20, 30, 30);
    return image;
};

/**
 * @param {string} message Message to log.
 */
var testLog = function(message) {
    console.log(message);
    var displayLog = document.createElement('div');
    displayLog.textContent = message;
    document.body.appendChild(displayLog);
};

/**
 * @return {number} time spent in milliseconds.
 */
var measureBrushStrokeTime = function(testPic, eventCount, radius, textureId, softness, blendId, report) {
    var bMode = BlendingMode[blendId];
    var w = testPic.bitmapWidth();
    var color = [39, 95, 188];
    var flow = 0.5;
    var opacity = 0.5;
    var angle = 0;
    var startTime = new Date().getTime();
    for (var i = 0; i < eventCount; ++i) {
        var event = testPic.createBrushEvent(color, flow, opacity, radius, textureId, softness, bMode, 0);
        angle += 0.2;
        for (var j = 0; j < 20; ++j) {
            var xa = Math.cos(angle + j * 0.02) / 20;
            var ya = Math.sin(angle + j * 0.02) / 20;
            var x = (xa * j + 1) * w * 0.5;
            var y = (ya * j + 1) * w * 0.5;
            event.pushCoordTriplet(x, y, 1.0);
        }
        testPic.pushEvent(event);
    }
    testPic.display();
    var totalTime = new Date().getTime() - startTime;
    if (report) {
        var logTime = function(mode, testTextureId, blendMode, time) {
            var timeMessage = 'Mode: ' + mode + ', blend mode: ' + blendMode + ', texture id: ' + testTextureId + ', brush events per second: ' +
                          (eventCount / time * 1000).toFixed(2);
            testLog(timeMessage);
        };
    
        var picElement = testPic.pictureElement();
        picElement.style.width = '500px';
        picElement.style.height = '500px';
        picContainer.appendChild(picElement);
        logTime(testPic.mode, testTextureId, blendId, totalTime);
    }
    return totalTime;
}

var picContainer;
var pictureMode = 'webgl';
var blendMode = 'normal';
var testTextureId = 0;

var runTest = function() {
    var eventCount = pictureMode === 'canvas' ? 200 : pictureMode === 'webgl' ? 1000 : 500;
    var bufferHasAlpha = true;
    var radius = 20;
    var softness = 1.0;

    var w = 1024;
    var brushTextureData = [testTextureCanvas()];
    var testPic = new Picture(0, null, new Rect(0, w, 0, w), 1.0,
                              PictureRenderer.create([pictureMode], brushTextureData));
    if (testPic === null) {
        testLog('Could not test mode ' + pictureMode);
        return undefined;
    }
    testPic.addBuffer(0, [255, 255, 255, 128], bufferHasAlpha);
    for (var report = 0; report <= 1; ++report) {
        var doReport = report === 1;
        var totalTime = measureBrushStrokeTime(testPic, doReport ? eventCount : 200,
                                               radius, testTextureId, softness, blendMode, doReport);
    }
    return totalTime;
}

var init = function() {
    picContainer = document.createElement('div');
    picContainer.style.width = '500px';
    picContainer.style.height = '500px';
    document.body.appendChild(picContainer);

    var selection = function(id, options) {
        var select = document.createElement('select');
        select.id = id;
        for (var i = 0; i < options.length; ++i) {
            var opt = document.createElement('option');
            opt.value = options[i];
            opt.textContent = options[i];
            opt.id = id + i;
            select.appendChild(opt);
        }
        document.body.appendChild(select);
    }
    var getSelection = function(id) {
        var select = document.getElementById(id);
        var option = select.options[select.selectedIndex];
        return option.value;
    }
    var allModes = ['webgl', 'no-dynamic-webgl', 'no-float-webgl', 'canvas'];
    selection('mode', allModes);
    var textureIds = ['0', '1'];
    var p = document.createElement('span');
    p.textContent = ' texId ';
    document.body.appendChild(p);
    selection('texId', textureIds);
    var blendModes = [];
    for (var m in BlendingMode) {
        if (BlendingMode.hasOwnProperty(m)) {
            blendModes.push(m);
        }
    }
    selection('blendMode', blendModes);

    var run = document.createElement('input');
    run.type = 'button';
    run.value = 'Run test';
    run.onclick = function() {
        pictureMode = getSelection('mode');
        blendMode = getSelection('blendMode');
        picContainer.innerHTML = '';
        testTextureId = parseInt(getSelection('texId'));
        setTimeout(runTest, 100);
    }
    document.body.appendChild(run);

    var runAll = document.createElement('input');
    runAll.type = 'button';
    runAll.value = 'Run tests with all modes';
    runAll.onclick = function() {
        var j = 0;
        var runOne = function() {
            pictureMode = allModes[j];
            runTest();
            ++j;
            if (j < allModes.length) {
                setTimeout(preRun, 100);
            }
        }
        var preRun = function() {
            picContainer.innerHTML = '';
            setTimeout(runOne, 100);
        }
        preRun();
    }
    document.body.appendChild(runAll);
}

window['initBrushbench'] = init;
