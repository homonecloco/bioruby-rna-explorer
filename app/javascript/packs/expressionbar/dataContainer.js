//var jQuery = require('jquery');
var science = require('science');
var colorbrewer = require('colorbrewer');
require('string.prototype.startswith');
//  require("./expressionValues")
import ExpressionValues from "./expressionValues"
import GroupedValues from "./groupedValues"
import {parseFactors, getGroupFactorDescription, getGroupFactorLongDescription, parseOrthoGroups} from "./factorHelpers"
import FactorGroup from "./factorGroup";
import { getFilesChange } from "fork-ts-checker-webpack-plugin/lib/reporter/FilesChange";

 class ExpressionData{
	/**
	 * @type {Map<string, FactorGroup>}
	 */
	factors;
	constructor(data, options) {
		for (var attrname in data) {
			// console.log(attrname);
			if (attrname == 'values'){
				this[attrname] = this._sortGeneOrder(attrname, data[attrname]);
			}else if(attrname == 'factors'){
				this.factors = parseFactors(data[attrname]);
			}else if(attrname == 'ortholog_groups'){
				this.ortholog_groups = parseOrthoGroups(data[attrname]);
			}else {
				this[attrname] = data[attrname];
			}
			// console.log(this[attrname]);
		}
		console.log(options);
		this.opt = options;
		this.sortOrder = [];
	}

	getExpressionValueTypes(){
		var keys = Object.keys(this.values);
		if(keys.length == 0){
			return [];
		}
		var firstVals = this.values[keys[0]];
		return Object.keys(firstVals);
	}


	setAvailableFactors(){
		var groups = this.factorOrder;
		var fo = this.factorOrder;
		var sf = this.selectedFactors;
		var optFO = this.opt.renderedOrder;
		var optSF = this.opt.selectedFactors;

		if( typeof optFO !== 'undefined'){
			fo = this.opt.renderedOrder;
		}

		if(typeof optSF !== 'undefined' ){
			sf = this.opt.selectedFactors;
		}

		var numberOfElements = 0;
		if(typeof this.renderedOrder !== 'undefined' ){
			numberOfElements = Object.keys(this.renderedOrder).length;
		}

		if(numberOfElements === 0){
			this.renderedOrder = jQuery.extend(true, {}, fo);
		}

		this.selectedFactors = jQuery.extend(true, {},  sf);
		var factorOrder = this.defaultFactorOrder;

		// this.factors = new Map();
		// for (var f in factorOrder) {
		// 	var g = factorOrder[f];
		// 	for(var k in groups[g]){
		// 		if(! this.factors.has(g)){
		// 			this.factors.set(g, new Set());
		// 		}
		// 		var currentSet = this.factors.get(g);
		// 		currentSet.add(k);
		// 	}  
		// }
	};



	prepareColorsForFactors(){//TODO: this should go somewher in the rendering, not in the data. 
	//this.factorColors = Map.new();
	this.totalColors = 8;
	var self = this;
	var colors = [
	colorbrewer.Pastel2[this.totalColors],
	colorbrewer.Accent[this.totalColors],
	colorbrewer.Dark2[this.totalColors],
	colorbrewer.Set1[this.totalColors],
	colorbrewer.Set2[this.totalColors],
	colorbrewer.Paired[this.totalColors],
	colorbrewer.Pastel1[this.totalColors], 
	colorbrewer.Set3[this.totalColors]
	];
	this.factorColors= new Map();  
	var i = 0;  
	this.factors.forEach(function(fg, key, map){
		var color = new Map();
		var index =  i % self.totalColors ;
		var currentColorSet = colors[index];
		var j = 0;  
		fg.factors.forEach((factor, name) => {
			color[name] = currentColorSet[j++ % self.totalColors ]; //We will eventually need to remove this line. 
			factor.color = color[name];
		}) 
		i ++ ; 
		self.factorColors[key] = color;
	});
	return self.factorColors;
	};


	isFiltered(group){
		var ret = true;
		let selectedFactors = this.opt.selectedFactors;
		for(var f in group.factors){
			if(selectedFactors[f]){
				ret &= selectedFactors[f][group.factors[f]];   
			}else{
				throw new Error('The factor ' + f + ' is not available (' + this.selectedFactors.keys + ')');
			}

		}
		return !ret;
	};

	/**
	 * 
	 * @param {string} fact 
	 * @returns {Array<FactorGroup>}
	 */
	getSortedFactors(fact) {
		/**
		 * @type{FactorGroup}
		 */
		let factors = [...this.factors.get(fact)];
		return factors.sort((a,b)=> a.order - b.order);
		
		// var i = this.defaultFactorOrder[factor];
		// var obj = this.renderedOrder[i];
		// var keys = []; 
		// for(var key in obj) {
		// 	keys.push(key);
		// }
		// return keys.sort(function(a,b){return obj[a] - obj[b];});
	};

	/**
	 * @return {Array<FactorGroup>}
	 */
	get sortedFactorGroups(){
		return [...this.factors.values()].sort((a,b) => a.order - b.order);
	}

	get renderedOrder(){
		let ret = {}
		this.sortedFactorGroups.forEach(fg => {
			ret[fg.name] = fg.sortedFactors.map(f => f.name);
		})
		return ret;
	}

	/*
	The only parameter, sortOrder, is an array of the factors that will be used to sort. 
	*/
	sortRenderedGroups(){
		// console.log("Re-sorting");
		var i;
		// console.log(this.renderedData);
		if(this.renderedData.length == 0){
			return;
		}
		// console.log("We enter to the method properlu");
		var sortable = this.renderedData[0].slice();
		// console.log(sortable);
		var sortOrder =  this.sortOrder;
		// console.log(sortOrder);
		var sorted = sortable.sort((a, b) => {
			for(let o of sortOrder){
				let fg = this.factors.get(o);
				let fa = fg.factors.get(a.factors[o]);
				let fb = fg.factors.get(b.factors[o]);
				if(typeof fa === 'undefined' || typeof fb === 'undefined'){
					continue;
				}
				if(fa.order > fb.order) {
					return 1;
				}
				if (fa.order < fb.order) {
					return -1;
				}
			}
			return a.id > b.id  ? 1 : -1;
		});

		for ( i = 0; i < sorted.length; i++) {
			sorted[i].renderIndex = i;
		}

		for(i = 0; i < this.renderedData.length; i++){
			for (var j = 0; j < sorted.length; j++) { 
				// console.log(sorted[j]);
				var obj = this.renderedData[i][sorted[j].id];
				if(!obj){
					continue;
				}
				// console.log(obj);
				obj.renderIndex = sorted[j].renderIndex;
			}
		}
	};


	hasExpressionValue(property){
		for(var gene in this.values){
			if(typeof this.values[gene][property] === 'undefined'){
				return false;
			}else{
				return true;
			}
		}
	}

	getDefaultProperty(){
		for(var gene in this.values){
			var vals = this.values[gene];
			for(var v in vals){
				return v;
			}
		}
	}


	//WARN: This method sets "this.renderedData" to the result of this call. 
	//This means that the function is not stateles, but the object is the container
	//For the data. It could be possible to make it "reentrant"
	getGroupedData(property, groupBy){
		// console.log(groupBy);
		var dataArray = [];
		for(var gene in this.values){
			// console.log(gene);
			if(!this.opt.showHomoeologues && 
				( 	
					gene !== this.gene &&  
					gene !==  this.compare 
					) 
				)
			{
				continue;
			}
			var i = 0;
			var innerArray;
			if(groupBy === 'ungrouped'){
				innerArray = []; 
				var data = this.values[gene][property];
				for(var o in data) {  
					var oldObject = data[o];
					var newObject = this._prepareSingleObject(i, oldObject);
					newObject.gene = gene;
					var filtered = this.isFiltered(newObject);
					if (! filtered){
						innerArray.push(newObject);
						i++;
					}

				}
				dataArray.push(innerArray);
			}else if(groupBy === 'groups'){
				innerArray = this._fillGroupByExperiment(i++, gene, property);
				dataArray.push(innerArray);
			}else if(groupBy.constructor === Array){
				//This is grouping by factors.  
				innerArray = this.#fillGroupByFactor(i++, gene, property, groupBy);
				dataArray.push(innerArray);
			}else{
				console.log('Not yet implemented');
			}
		}
		this.addMissingFactors(dataArray);
		if(this.renderedData && this.renderedData.length > 0){ 
			this.setRenderIndexes(dataArray,this.renderedData);
		}
		this.renderedData = dataArray;
		// this.renderedData.forEach(gene_arr => gene_arr.forEach(group => group.log = this.isLog));
		// if(this.isLog()){

		// 	this.calculateLog2();
		// }
		this.calculateMinMax();
		return dataArray;
	};

	calculateStats(newObject){
		var v = science.stats.mean(newObject.data);
		var stdev = Math.sqrt(science.stats.variance(newObject.data));
		newObject.value = v;
		newObject.stdev = stdev;
		

	};

	isLog(){
		return  this.opt.calculateLog;
	};

	calculateMinMax(){
		var max = -Infinity;
		var min = Infinity;
		var isLog = this.isLog();
		
		for(var i in this.renderedData){
			for(var j in this.renderedData[i]){
				var curr =this.renderedData[i][j]
				var val = curr.value ;
				if(!isLog){
					val += curr.stdev;
				} 
				if(val > max) max = val ;
				if(val < min) min = val ;
			}
		}
		//if(isLog){
		min = 0;
		//}
		
		this.max = max;
		this.min = min;
		//this.min = -1;
		//this.max = 1;
	}

	_prepareSingleObject(index, oldObject){
		var newObject = JSON.parse(JSON.stringify(oldObject));

		newObject.renderIndex = index;
		newObject.id = index;
		newObject.name = this.experiments[newObject.experiment].name;
		newObject.data = []; 
		newObject.data.push(oldObject.value); 
		newObject.value = oldObject.value;
		newObject.stdev = 0;
		var group = this.experiments[newObject.experiment].group;
		newObject.factors = this.groups[group].factors;
		return newObject;
	};



	_fillGroupByExperiment(index, gene, property){
		var groups ={};
		var innerArray = [];
		var data = this.values[gene][property];
		var g = this.groups;
		var e = this.experiments;
		var o;
		var filtered;
		var i = index;
		for(o in g){  
			// var newObject = this._prepareGroupedByExperiment(i++,o);
			/** @type {GroupedValues}} */
			var newObject = new GroupedValues(i++, g[o].description);
			newObject.gene = gene;
			newObject.description = newObject.name;
			newObject.longDescription = g[o].description;
			newObject.factors = g[o].factors;
			groups[g[o].name] = newObject;
		}
		for(o in e){
			var values = data[o];
			groups[e[o].name].addValueObject(values);
		}
		i = index;
		for(o in groups){
			var newObject = groups[o];
			newObject.gene = gene;
			newObject.calculateStats();
			if(!this.isFiltered(newObject)){
				newObject.renderIndex = i;
				newObject.id = i++;
				innerArray.push(newObject);
			}

		}
		return innerArray;
	};

	#fillGroupByFactor(index, gene, property, groupBy){
		var groups ={};
		/** @type {[GroupedValues]} */
		var innerArray = [];
		var data = this.values[gene][property];
		var g = this.groups;
		var e = this.experiments;
		var names = [];
		var o;
		var i = index;
		// console.log(g);
		for(o in g){  
			var description = this.getGroupFactorDescription(g[o], groupBy);
			var longDescription = this.getGroupFactorLongDescription(g[o], groupBy);
			if(names.indexOf(description) === -1){
				var newObject = new GroupedValues(i++, description);
				// console.log(`Adding: ${description}`);
				newObject.gene = gene;
				newObject.longDescription = longDescription;
				var factorValues = this.getGroupFactor(g[o], groupBy);
				newObject.factors = factorValues;
				groups[description] = newObject;
				names.push(description);
			}
		}
		// console.log(groups);
		i = index;
		for(o in e){
			if( !data  || typeof data[o] === 'undefined' ){
				continue; //This is for the cases when the data is set up but not defined
			}
			var group = g[e[data[o].experiment].group];

			if(!this.isFiltered(group)){
				var description = this.getGroupFactorDescription(g[e[o].group], groupBy);
				groups[description].addValueObject(data[o]);
			}
		}
		for(o in groups){
			var newObject = groups[o];
			if(newObject.isEmpty){
				continue;
			}
			newObject.log = this.isLog();
			innerArray.push(newObject);
		}
		return innerArray;
	};

	addNames(o){
		var factors = o.factors;
		var groupBy = []; //TODO: change this to something like factors.keys
		for(var i in factors){
			groupBy.push(i);

		}
		o.name = this.getGroupFactorDescription(o, groupBy);
		o.longDescription = this.getGroupFactorLongDescription(o, groupBy);
	};

	getGroupFactorDescription(o,groupBy){
		return getGroupFactorDescription(o, groupBy, this.factors)
		// var factorArray = [];
		// var factorNames = this.longFactorName;
		// var numOfFactors = groupBy.length;
		// var arrOffset = 0;
		// for(var i in groupBy) {
		// 	var grpby = groupBy[i];
		// 	var currFact = factorNames[grpby];
		// 	var currShort =  o.factors[groupBy[i]]; 
		// 	if(typeof currShort === 'undefined' ){
		// 		console.error(groupBy[i] + ' is not present in ' + o.factors );
		// 		console.error(o.factors);
		// 	}
		// 	var currLong = currFact[currShort];
		// 	factorArray[i - arrOffset ] = currLong;
		// 	if(numOfFactors > 4 || currLong.length > 20 ){
		// 		factorArray[i - arrOffset ] = currShort;
		// 	}
		// };
		// return factorArray.join(', ');
	};

	getGroupFactorLongDescription(o,groupBy){
		return getGroupFactorLongDescription(o, groupBy, this.factors);
		// var factorArray = [];
		// var factorNames = this.longFactorName;
		// //console.log(factorNames);

		// var numOfFactors = groupBy.length;
		// for(var i in groupBy) {
		// 	var grpby = groupBy[i];
		// 	var currFact = factorNames[grpby];
		// 	var currShort =  o.factors[groupBy[i]]; 
		// 	var currLong = currFact[currShort];
		// 	factorArray[i] = currLong;

		// }
		// return factorArray.join(', ');
	};


	getGroupFactor(o,groupBy){
		var factorArray = {};
		for (var i in groupBy) {
			factorArray[groupBy[i]] = o.factors[groupBy[i]];
		}
		return factorArray;
	};


	//To keep the indeces we reiterate and set them
	setRenderIndexes(to, from){
		for(var i in to){
			var gene=from[i];
			for(var j in gene){
				to[i][j].renderIndex = from[0][j].renderIndex; //we only use the first gene
			}
		}
	};

	_equals(factorA, factorB){
		for(let a in factorA){		
			if(factorA[a] != factorB[a]){
				return false
			}
		}
		//We test in both sides, to make sure to compare all the 
		//possible entries in both objects. 
		for(let a in factorB){
			if(factorA[a] != factorB[a]){
				return false
			}
		}
		return true;
	};

	_arrayContains(array, object){
		for(let i in array){
			if(this._equals(array[i], object)){
				return i;
			}
		}
		return -1;
	};

	addMissingFactors(dataArray){
		//console.log(dataArray);
		var allFactors = [];
		for( var i in dataArray){
			var gene = dataArray[i];
			for(var j in gene){
				var factors = dataArray[i][j].factors
				if(this._arrayContains(allFactors, factors) == -1){
					allFactors.push(factors);
				}
			}
		}
		//console.log(allFactors);
		var fullDataArray = []
		for(var i in dataArray){
			var gene = dataArray[i];
			if(gene.length == 0){
				continue;
			}
			var localFactors = [];
			var tmpDataArray = [];
			var localDataArray = [];
			for(var j in gene){
				localFactors.push(dataArray[i][j].factors);
				tmpDataArray.push(dataArray[i][j]);
			}
			for(var j in allFactors){
				var localObject = this._arrayContains(localFactors, allFactors[j])
				j =   parseInt(j);
				if(localObject >= 0){
					localDataArray.push(tmpDataArray[localObject]);
					//console.log(tmpDataArray[localObject]);
				}else{
					var obj = new GroupedValues(j, "");
					// console.log(gene);
					// console.log(obj);
					obj.gene = gene[0].gene;
					obj.factors = allFactors[j];
					localDataArray.push( obj);
				}
				//localDataArray[j].id = j;
				//localDataArray[j].renderIndexs = j;
			}
			for(var j in localDataArray){
				j = parseInt(j);
				//console.log(j);
				localDataArray[j].id = j;
				localDataArray[j].renderIndex = j;
				this.addNames(localDataArray[j]);
				

				//console.log(localDataArray[j]);
			}
			//console.log(localDataArray);
			fullDataArray.push(localDataArray);

		}
		for(var j in fullDataArray){
			//console.log(j);
			dataArray[j] = fullDataArray[j];
		}
		//console.log(dataArray);
		//console.log(fullDataArray);
		

	};

	addSortPriority(factor, end){
		console.log("Adding sort priority");
		console.log(factor);
		console.log(this.sortOrder);
		end = typeof end !== 'undefined' ? end : true;
		this.removeSortPriority(factor);
		if(end === true){
			this.sortOrder.push(factor);
		}else{
			this.sortOrder.unshift(factor);
		}
		console.log(this.sortOrder);

	};

	removeSortPriority(factor){
		var index = this.sortOrder.indexOf(factor);
		if (index > -1) {
			this.sortOrder.splice(index, 1);
		}
	};

	_sortGeneOrder (key, value){ //TODO: This method shouldn't be needed. 
		var geneOrder = {};
		var gene;
		if(typeof this.tern !== 'undefined' && !$.isEmptyObject(this.tern)){
			for (var i = 0; i < Object.keys(this.tooltip_order).length; i++){
				gene = this.tern[this.tooltip_order[i]];
				if(typeof value[gene] !== 'undefined'){
					geneOrder[gene] = value[gene];
				}
			}
			return geneOrder;
		} else {
			return value;	
		}
	}

	get hasTern(){
		return "tern" in this && Object.keys(this.tern).length === 3;
	}

	get hasHomologues(){
		return "homologues" in this && this.homologues.length > 0
	}

	get longFactorName(){
		let ret = {}
		this.factors.forEach((fg, group) => fg.factors.forEach(f => ret[group][f.name] = f.description));
		return ret;
	}

}

export default ExpressionData;