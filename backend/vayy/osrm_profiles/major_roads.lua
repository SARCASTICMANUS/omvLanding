-- Keep the stock OSRM car access, speed, and duration rules; adjust only route cost.
local car = dofile("/opt/car.lua")
local process_way = car.process_way

local road_cost = {
  motorway = 0.7,
  motorway_link = 0.85,
  trunk = 0.72,
  trunk_link = 0.85,
  primary = 0.75,
  primary_link = 0.9,
  secondary = 0.85,
  secondary_link = 0.95,
  tertiary = 1.5,
  tertiary_link = 1.35,
  unclassified = 3.5,
  residential = 5,
  living_street = 10,
  service = 8,
  track = 8,
  road = 6,
  alley = 14,
}

car.process_way = function(profile, way, result, relations)
  process_way(profile, way, result, relations)

  local highway = way:get_value_by_key("highway")
  local factor = road_cost[highway] or 1
  local service = way:get_value_by_key("service")
  if highway == "service" and (service == "alley" or service == "parking_aisle") then
    factor = 7
  elseif highway == "service" and service == "driveway" then
    factor = 5
  end

  local width = tonumber((way:get_value_by_key("width") or ""):match("^%s*(%d+%.?%d*)"))
  local lanes = tonumber((way:get_value_by_key("lanes") or ""):match("^%s*(%d+%.?%d*)"))
  local narrow = way:get_value_by_key("narrow") == "yes"
  if factor > 1 and (narrow or width and width <= 3 or lanes and lanes <= 1) then
    factor = factor * 1.5
  end

  if factor ~= 1 then
    -- Rates and weights affect route choice; speeds still determine ETA.
    if result.forward_rate and result.forward_rate > 0 then
      result.forward_rate = result.forward_rate / factor
    end
    if result.backward_rate and result.backward_rate > 0 then
      result.backward_rate = result.backward_rate / factor
    end
    if result.weight and result.weight > 0 then
      result.weight = result.weight * factor
    end
  end
end

return car
