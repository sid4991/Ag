#!/bin/bash

cd /home/hnoorazar/remote_sensing_codes/03_regularize_fillGap/01_regularize/qsubs/
for runname in {1..48}
do
qsub ./q_$runname.sh
done