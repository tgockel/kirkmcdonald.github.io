/*Copyright 2019-2021 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { powerRepr } from "./display.js"
import { Icon } from "./icon.js"
import { Rational, zero, one } from "./rational.js"

let thirty = Rational.from_float(30)

class Building {
    constructor(key, name, col, row, categories, speed, moduleSlots, power, fuel) {
        this.key = key
        this.name = name
        this.categories = new Set(categories)
        this.speed = speed
        this.moduleSlots = moduleSlots
        this.power = power
        this.fuel = fuel

        this.icon_col = col
        this.icon_row = row
        this.icon = new Icon(this)
    }
    less(other) {
        if (!this.speed.equal(other.speed)) {
            return this.speed.less(other.speed)
        }
        return this.moduleSlots < other.moduleSlots
    }
    getCount(spec, recipe, rate) {
        return rate.div(this.getRecipeRate(spec, recipe))
    }
    getRecipeRate(spec, recipe) {
        let modules = spec.getModuleSpec(recipe)
        let speedEffect
        if (modules) {
            speedEffect = modules.speedEffect()
        } else {
            speedEffect = one
        }
        return recipe.time.reciprocate().mul(this.speed).mul(speedEffect)
    }
    canBeacon() {
        return this.moduleSlots > 0
    }
    drain() {
        return this.power.div(thirty)
    }
    renderTooltip() {
        let self = this
        let t = d3.create("div")
            .classed("frame", true)
        let header = t.append("h3")
        header.append(() => self.icon.make(32, true))
        header.append(() => new Text(self.name))
        let line = t.append("div")
        line.append("b")
            .text("Energy consumption: ")
        let {power, suffix} = powerRepr(this.power)
        line.append("span")
            .text(`${power.toDecimal(0)} ${suffix}`)
        line = t.append("div")
        line.append("b")
            .text("Crafting speed: ")
        line.append("span")
            .text(this.speed.toDecimal())
        line = t.append("div")
        line.append("b")
            .text("Module slots: ")
        line.append("span")
            .text(String(this.moduleSlots))
        return t.node()
    }
}

class Miner extends Building {
    constructor(key, name, col, row, categories, miningSpeed, moduleSlots, power, fuel) {
        super(key, name, col, row, categories, 0, moduleSlots, power, fuel)
        this.miningSpeed = miningSpeed
    }
    less(other) {
        return this.miningSpeed.less(other.miningSpeed)
    }
    drain() {
        return zero
    }
    getRecipeRate(spec, recipe) {
        // XXX: Speed effect
        return this.miningSpeed.div(recipe.miningTime)
    }
    renderTooltip() {
        let self = this
        let t = d3.create("div")
            .classed("frame", true)
        let header = t.append("h3")
        header.append(() => self.icon.make(32, true))
        header.append(() => new Text(self.name))
        let line = t.append("div")
        line.append("b")
            .text("Energy consumption: ")
        let {power, suffix} = powerRepr(this.power)
        line.append("span")
            .text(`${power.toDecimal(0)} ${suffix}`)
        line = t.append("div")
        line.append("b")
            .text("Mining speed: ")
        line.append("span")
            .text(this.miningSpeed.toDecimal())
        line = t.append("div")
        line.append("b")
            .text("Module slots: ")
        line.append("span")
            .text(String(this.moduleSlots))
        return t.node()
    }
}

let rocketLaunchDuration = Rational.from_floats(2434, 60)

function launchRate(spec) {
    let partRecipe = spec.recipes.get("rocket-part")
    let partFactory = spec.getBuilding(partRecipe)
    let partItem = spec.items.get("rocket-part")
    let gives = partRecipe.gives(partItem)
    // The base rate at which the silo can make rocket parts.
    let rate = Building.prototype.getRecipeRate.call(partFactory, partRecipe, spec)
    // Number of times to complete the rocket part recipe per launch.
    let perLaunch = Rational.from_float(100).div(gives)
    // Total length of time required to launch a rocket.
    let time = perLaunch.div(rate).add(rocketLaunchDuration)
    let launchRate = time.reciprocate()
    let partRate = perLaunch.div(time)
    return {part: partRate, launch: launchRate}
}

class RocketLaunch extends Building {
    getRecipeRate(spec, recipe) {
        return launchRate(spec).launch
    }
}

class RocketSilo extends Building {
    getRecipeRate(spec, recipe) {
        return launchRate(spec).part
    }
}

function renderTooltipBase() {
    let self = this
    let t = d3.create("div")
        .classed("frame", true)
    let header = t.append("h3")
    header.append(() => self.icon.make(32, true))
    header.append(() => new Text(self.name))
    return t.node()
}

export function getBuildings(data) {
    let buildings = []
    let pumpDef = data["offshore-pump"]["offshore-pump"]
    let pump = new Building(
        "offshore-pump",
        pumpDef.localized_name.en,
        pumpDef.icon_col,
        pumpDef.icon_row,
        ["water"],
        one,
        0,
        zero,
        null,
    )
    pump.renderTooltip = renderTooltipBase
    buildings.push(pump)
    let reactorDef = data["reactor"]["nuclear-reactor"]
    let reactor = new Building(
        "nuclear-reactor",
        reactorDef.localized_name.en,
        reactorDef.icon_col,
        reactorDef.icon_row,
        ["nuclear"],
        one,
        0,
        zero,
        null
    )
    reactor.renderTooltip = renderTooltipBase
    buildings.push(reactor)
    let boilerDef = data["boiler"]["boiler"]
    // XXX: Should derive this from game data.
    let boiler_energy = Rational.from_float(1800000)
    let boiler = new Building(
        "boiler",
        boilerDef.localized_name.en,
        boilerDef.icon_col,
        boilerDef.icon_row,
        ["boiler"],
        one,
        0,
        boiler_energy,
        "chemical"
    )
    boiler.renderTooltip = renderTooltipBase
    buildings.push(boiler)
    let siloDef = data["rocket-silo"]["rocket-silo"]
    let launch = new RocketLaunch(
        "rocket-silo",
        siloDef.localized_name.en,
        siloDef.icon_col,
        siloDef.icon_row,
        ["rocket-launch"],
        one,
        0,
        zero,
        null
    )
    launch.renderTooltip = renderTooltipBase
    buildings.push(launch)
    for (let type of ["assembling-machine", "furnace"]) {
        for (let key in data[type]) {
            let d = data[type][key]
            let fuel = null
            if (d.energy_source && d.energy_source.type === "burner") {
                fuel = d.energy_source.fuel_category
            }
            buildings.push(new Building(
                d.name,
                d.localized_name.en,
                d.icon_col,
                d.icon_row,
                d.crafting_categories,
                Rational.from_float_approximate(d.crafting_speed),
                d.module_slots,
                Rational.from_float_approximate(d.energy_usage),
                fuel
            ))
        }
    }
    for (let key in data["rocket-silo"]) {
        let d = data["rocket-silo"][key]
        buildings.push(new RocketSilo(
            d.name,
            d.localized_name.en,
            d.icon_col,
            d.icon_row,
            d.crafting_categories,
            Rational.from_float_approximate(d.crafting_speed),
            d.module_slots,
            Rational.from_float_approximate(d.energy_usage),
            null
        ))
    }
    for (let key in data["mining-drill"]) {
        let d = data["mining-drill"][key]
        if (d.name == "pumpjack") {
            continue
        }
        let fuel = null
        if (d.energy_source && d.energy_source.type === "burner") {
            fuel = d.energy_source.fuel_category
        }
        buildings.push(new Miner(
            d.name,
            d.localized_name.en,
            d.icon_col,
            d.icon_row,
            ["mining-basic-solid"],
            Rational.from_float_approximate(d.mining_speed),
            d.module_slots,
            Rational.from_float_approximate(d.energy_usage),
            fuel
        ))
    }
    return buildings
}
