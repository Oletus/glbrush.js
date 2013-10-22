@pushd %~dp0
gjslint --max_line_length 120 --nobeep *.js
gjslint --max_line_length 120 --nobeep unit_tests/*.js
@popd
