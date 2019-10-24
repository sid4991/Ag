#!/bin/bash

## Export all environment variables in the qsub command's environment to the
## batch job.
#PBS -V

## Define a job name
#PBS -N 01_dyn_mod_chill_sea

## Define compute options
#PBS -l nodes=1:ppn=1,walltime=10:00:00
#PBS -l mem=2gb
#PBS -q hydro
#PBS -t 1-62

## Define path for output & error logs
#PBS -k o
##PBS -j oe
#PBS -e /home/hnoorazar/chilling_codes/current_draft/01/other_three_seasons/error/dynam_mod_E_chill_sea
#PBS -o /home/hnoorazar/chilling_codes/current_draft/01/other_three_seasons/error/dynam_mod_O_chill_sea

## Define path for reporting
#PBS -m abe

echo
echo We are in the $PWD directory
echo

cd $PBS_O_WORKDIR

echo
echo We are now in $PWD.
echo

dir_list=()
while IFS= read -d $'\0' -r file ; do
dir_list=("${dir_list[@]}" "$file")
done < <(find /data/hydro/jennylabcommon2/metdata/maca_v2_vic_binary/ -mindepth 2 -maxdepth 2 -type d -print0)

#echo
#echo "${dir_list[@]}"
#echo

# First we ensure a clean running environment:
module purge

# Load R
module load udunits/2.2.20
module load libxml2/2.9.4
module load gdal/2.1.2_gcc proj/4.9.2
module load gcc/7.3.0 r/3.5.1/gcc/7.3.0
module load gcc/7.3.0
module load r/3.5.1/gcc/7.3.0
module load r/3.5.1
# module load R

# new job for each directory index, up to max arrayid
cd ${dir_list[((${PBS_ARRAYID} - 1))]}

Rscript --vanilla /home/hnoorazar/chilling_codes/current_draft/01/other_three_seasons/d_modeled.R "dynamic" chill_sea

echo
echo "----- DONE -----"
echo
cd /data/hydro/users/Hossein/chill/data_by_core/dynamic/01/chill_sea/modeled
rm -r MIROC-ESM
exit 0
