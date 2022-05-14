class RandomService {
  // eslint-disable-next-line class-methods-use-this
  getInt(lim: number) {
    return Math.floor(Math.random() * lim);
  }

  // eslint-disable-next-line class-methods-use-this
  shuffleArray(actualArray: any[]) {
    const array = [...actualArray];
    let currentIndex = array.length;
    let randomIndex;

    // While there remain elements to shuffle...
    while (currentIndex !== 0) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
  }
}

export default RandomService;
