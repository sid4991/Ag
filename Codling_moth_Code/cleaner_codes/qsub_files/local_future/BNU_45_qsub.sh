#!/bin/bash
#v#!/usr/bin/env Rscript

#PBS -N BNU_45
#PBS -l nodes=1:ppn=1,walltime=40:00:00
#PBS -l mem=10gb
#PBS -q hydro
#PBS -e BNU_45_error.txt
#PBS -o BNU_45_output.txt
#PBS -M h.noorazar@yahoo.com
#PBS -m abe
cd $PBS_O_WORKDIR

# Ensure a clean running environment:
module purge

# Load modules (if needed)
module load R/R-3.2.2_gcc

/home/hnoorazar/cleaner_codes/drivers/local_future/LF_CM_45_scenario_driver.R BNU-ESM

exit 0
