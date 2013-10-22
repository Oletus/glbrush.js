@pushd %~dp0
gjslint --max_line_length 120 *.js
gjslint --max_line_length 120 unit_tests/*.js
@popd
