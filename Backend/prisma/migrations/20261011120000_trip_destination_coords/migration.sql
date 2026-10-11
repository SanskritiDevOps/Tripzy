-- Map centre of the trip destination (geocoded with OpenStreetMap Nominatim)
ALTER TABLE "trips" ADD COLUMN     "destination_lat" DOUBLE PRECISION,
ADD COLUMN     "destination_lng" DOUBLE PRECISION;
