class RandomService {
	getInt(lim: number) {
		return Math.floor(Math.random()*lim);
	}

	shuffleArray(actualArray: any[]) {
		const array = [...actualArray];
		let currentIndex = array.length,  randomIndex;
	
		// While there remain elements to shuffle...
		while (currentIndex != 0) {
	
			// Pick a remaining element...
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex--;
	
			// And swap it with the current element.
			[array[currentIndex], array[randomIndex]] = [
				array[randomIndex], array[currentIndex]];
		}
	
		return array;
	}
}

export default RandomService;