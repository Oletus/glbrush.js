glbrush.js
==========

Rendering library for web-based painting applications. Includes WebGL and software (2D canvas) backends.

See a simple example in action: http://oletus.github.io/glbrush.js/example.html

Supported features so far include:

* Hard-edged, soft and texturized circular airbrush with opacity, flow and dynamic size control.
* Linear gradients.
* Unlimited undo, and all operations except layer merges and layer stack reordering can be undone out of sequence.
* Wide support for blending modes: normal, erase, multiply, screen, overlay, hard light, pin light, vivid light, difference, exclusion...
* Alpha blended layers.
* Replay animation.
* Rasterization is done internally with at least 16 bits of precision, resulting in much better quality soft brush rendering than what is achievable with 2D canvas.
* Serialization of pictures in text-based vector format and resizing them when parsing the serialization.

Code standards:

* Largely unit tested using jasmine. New code should pass all existing tests. New functionality should be unit tested.
* JSDoc annotated with Closure compiler in mind - https://developers.google.com/closure/compiler/docs/js-for-compiler
* Style-checked with gjslint.
* Compatible with newest Chrome, Firefox and Internet Explorer 11 (earlier IE with software backend)

Contributions welcome! Getting started for contributors:

* Install Python 2.7 and Closure linter.
* run hooks/install.py to install automated testing hooks. Contributions that don't pass these are not accepted.
