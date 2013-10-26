pushd `dirname $0` > /dev/null
gjslint --max_line_length 120 --nobeep *.js
gjslint --max_line_length 120 --nobeep unit_tests/*.js
popd > /dev/null