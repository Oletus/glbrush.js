glbrush.js
==========

Rendering library for web-based painting applications. Includes WebGL and software (2D canvas) backends.

Supported features so far include:

* Soft and hard-edged circular airbrush with opacity, flow and dynamic size control.
* Unlimited undo, and operations can be undone out of sequence.
* Alpha blended layers.
* Replay animation.
* Rasterization is done internally with at least 16 bits of precision, resulting in much better quality soft brush rendering than what is achievable with 2D canvas.
* Serialization of pictures in text-based vector format and resizing them when parsing the serialization.

Code standards:

* Largely unit tested using jasmine. New code should pass all existing tests. New functionality should be unit tested.
* JSDoc annotated with Closure compiler in mind - https://developers.google.com/closure/compiler/docs/js-for-compiler
* Style-checked with gjslint.
* Compatible with newest Chrome, Firefox and Internet Explorer (IE with software backend)

Contributions welcome!
